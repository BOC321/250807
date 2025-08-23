import { useState, useEffect, useMemo } from 'react'; 
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { computeScores } from '../../../src/lib/scoring';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function SurveyResultsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [respondentId, setRespondentId] = useState(null);
  const [responseId, setResponseId] = useState(null);

  const [survey, setSurvey] = useState(null);
  const [categories, setCategories] = useState([]);
  const [responses, setResponses] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [scoreRanges, setScoreRanges] = useState({ categories: {}, total: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [serveUrl, setServeUrl] = useState('');       // ← show a link if API returns one
  const [emailMessage, setEmailMessage] = useState(''); // ← show API message

  useEffect(() => {
    if (id) {
      const urlRespondentId = router.query.respondentId;
      const urlResponseId = router.query.responseId;
      
      if (urlResponseId) {
        setResponseId(urlResponseId);
      } else if (urlRespondentId) {
        setRespondentId(urlRespondentId);
      } else {
        fetchMostRecentResponse();
      }
    }
  }, [id, router.query]);

  useEffect(() => {
    if (id && (respondentId || responseId)) {
      fetchSurveyData();
    }
  }, [id, respondentId, responseId]);

  async function fetchMostRecentResponse() {
    try {
      console.log('🔄 FETCHING MOST RECENT RESPONSE (fallback mode)');
      
      const { data: surveyData, error: sErr } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', id)
        .single();
      if (sErr) throw sErr;
      setSurvey(surveyData);

      const { data: categoriesData, error: cErr } = await supabase
        .from('categories')
        .select('*, questions(*)')
        .eq('survey_id', id)
        .order('order');
      if (cErr) throw cErr;
      setCategories(categoriesData || []);

      const { data: responsesData, error: rErr } = await supabase
        .from('responses')
        .select('*')
        .eq('survey_id', id)
        .order('completed_at', { ascending: false })
        .limit(1);
      if (rErr) throw rErr;
      
      console.log('🔄 Most recent responses found:', responsesData);

      if (responsesData?.length) {
        const mostRecentResponse = responsesData[0];
        setResponses([mostRecentResponse]);
        setRespondentId(mostRecentResponse.id);
        
        console.log('🔄 Fetching answers for most recent response:', mostRecentResponse.id);

        const { data: answersData, error: aErr } = await supabase
          .from('answers')
          .select('*')
          .eq('response_id', mostRecentResponse.id);
        if (aErr) throw aErr;
        
        console.log('🔄 Most recent response answers:', answersData);
        setAnswers(answersData || []);

        router.replace(
          `/surveys/results/${id}?responseId=${mostRecentResponse.id}`,
          undefined,
          { shallow: true }
        );
      } else {
        console.log('🚫 No responses found for survey:', id);
        setResponses([]);
        setAnswers([]);
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  }

  async function fetchSurveyData() {
    try {
      const { data: surveyData, error: sErr } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', id)
        .single();
      if (sErr) throw sErr;
      setSurvey(surveyData);

      const { data: categoriesData, error: cErr } = await supabase
        .from('categories')
        .select('*, questions(*)')
        .eq('survey_id', id)
        .order('order');
      if (cErr) throw cErr;
      setCategories(categoriesData || []);

      // Use responseId if available, otherwise use respondentId for backward compatibility
      const actualResponseId = responseId || respondentId;
      
      console.log('🔍 FETCHING ANSWERS DEBUG:');
      console.log('  - URL responseId:', responseId);
      console.log('  - URL respondentId:', respondentId);
      console.log('  - Using actualResponseId:', actualResponseId);
      
      const { data: responsesData, error: rErr } = await supabase
        .from('responses')
        .select('*')
        .eq('survey_id', id)
        .eq('id', actualResponseId);
      if (rErr) {
        console.error('❌ Error fetching responses:', rErr);
        throw rErr;
      }
      console.log('📋 Found responses:', responsesData);
      setResponses(responsesData || []);

      if (responsesData?.length) {
        console.log('🔍 Fetching answers for response_id:', actualResponseId);
        const { data: answersData, error: aErr } = await supabase
          .from('answers')
          .select('*')
          .eq('response_id', actualResponseId);
        if (aErr) {
          console.error('❌ Error fetching answers:', aErr);
          throw aErr;
        }
        
        console.log('📊 RAW ANSWERS FROM DATABASE:');
        console.log('  - Number of answers found:', answersData?.length || 0);
        answersData?.forEach((answer, index) => {
          console.log(`  Answer ${index + 1}: Question ${answer.question_id} = "${answer.value}" (created: ${answer.created_at})`);
        });
        
        setAnswers(answersData || []);
      } else {
        console.log('❌ No responses found for actualResponseId:', actualResponseId);
        setAnswers([]);
      }

      const ranges = await fetchScoreRanges(id);
      setScoreRanges(ranges);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchScoreRanges(surveyId) {
    try {
      const { data: categoryRanges, error: catErr } = await supabase
        .from('score_ranges')
        .select('*')
        .eq('survey_id', surveyId)
        .not('category_id', 'is', null);
      if (catErr) throw catErr;

      const { data: totalRanges, error: totErr } = await supabase
        .from('score_ranges')
        .select('*')
        .eq('survey_id', surveyId)
        .is('category_id', null);
      if (totErr) throw totErr;

      const rangesByCategory = {};
      categoryRanges.forEach(r => {
        if (!rangesByCategory[r.category_id]) rangesByCategory[r.category_id] = [];
        rangesByCategory[r.category_id].push(r);
      });

      return { categories: rangesByCategory, total: totalRanges || [] };
    } catch (err) {
      console.error(err);
      return { categories: {}, total: [] };
    }
  }

  const getCategoryScores = () => {
    try {
      console.log('=== COMPREHENSIVE SCORING ANALYSIS ===');
      console.log('📊 Raw answers from database:', answers);
      console.log('📋 Categories structure:', categories.map(cat => ({
        id: cat.id,
        title: cat.title,
        questionCount: cat.questions?.length || 0
      })));
      
      // Show detailed question analysis
      categories.forEach(category => {
        console.log(`\n🔍 Category: ${category.title}`);
        console.log(`  Expected questions in category: ${category.questions?.length || 0}`);
        
        const categoryAnswers = answers.filter(answer => 
          category.questions?.some(q => q.id === answer.question_id)
        );
        console.log(`  Actual answers found in database: ${categoryAnswers.length}`);
        
        if (category.title === 'Cultural questions') {
          console.log(`  🔴 CULTURAL CATEGORY ANALYSIS:`);
          console.log(`    Questions in category: ${category.questions?.length || 0}`);
          console.log(`    Answers in database: ${categoryAnswers.length}`);
          console.log(`    Missing answers: ${(category.questions?.length || 0) - categoryAnswers.length}`);
          
          // Show which questions have answers and which don't
          category.questions?.forEach(question => {
            const hasAnswer = answers.find(a => a.question_id === question.id);
            console.log(`    Question ${question.id}: ${hasAnswer ? '✅ HAS ANSWER' : '❌ MISSING'}`);
          });
        }
        
        category.questions?.forEach(question => {
          const answer = answers.find(a => a.question_id === question.id);
          console.log(`  Question ${question.id}:`);
          console.log(`    Choices: ${JSON.stringify(question.choices)}`);
          console.log(`    Scores: ${JSON.stringify(question.choice_scores)}`);
          console.log(`    User Answer: "${answer?.value || 'NO ANSWER'}"`);
        });
      });
      
      // Check for any issues with answer data
      const answerIssues = [];
      answers.forEach(answer => {
        if (!answer.value) answerIssues.push(`Question ${answer.question_id}: null/undefined value`);
      });
      
      if (answerIssues.length > 0) {
        console.log('⚠️ ANSWER DATA ISSUES:', answerIssues);
      } else {
        console.log('✅ Answer data validation passed');
      }

      console.log('\n🧮 Computing scores using position-based logic...');
      // Use the proper scoring library to compute normalized percentages
      const { categoryPercents } = computeScores(
        categories, 
        answers, 
        {
          treatMissingAsZero: true,
          useQuestionWeights: false,
          useCategoryWeights: false
        }
      );
      
      console.log('📈 Computed categoryPercents:', categoryPercents);
      
      // Convert percentages to 0-1 range for compatibility with existing code
      const catScores = {};
      Object.entries(categoryPercents).forEach(([title, percent]) => {
        catScores[title] = percent / 100; // Convert back to 0-1 range
      });
      
      console.log('🎯 Final catScores for display:', catScores);
      return catScores;
    } catch (err) {
      console.error('Error computing category scores:', err);
      // Fallback to simple averaging if scoring library fails
      const catScores = {};
      categories.forEach(cat => {
        const qIds = cat.questions.map(q => q.id);
        const answersInCat = answers.filter(a => qIds.includes(a.question_id) && a.score != null);
        if (answersInCat.length) {
          const total = answersInCat.reduce((sum, a) => sum + (a.score || 0), 0);
          catScores[cat.title] = Math.min(1, total / answersInCat.length); // Clamp to max 1.0
        } else {
          catScores[cat.title] = 0;
        }
      });
      console.log('Fallback catScores:', catScores);
      return catScores;
    }
  };

  // ✅ FIXED: call the correct API route for Pages Router → /api/reports/generate
  const handleEmailSubmit = async e => {
    e.preventDefault();
    setEmailMessage('');
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setEmailError('Please enter a valid email');
      return;
    }

    setSubmittingEmail(true);
    setEmailError('');
    try {
      const recentResponse = responses.sort(
        (a, b) => new Date(b.completed_at) - new Date(a.completed_at)
      )[0];
      if (!recentResponse) throw new Error('No response found');

      const { error: updErr } = await supabase
        .from('respondents')
        .update({ email })
        .eq('id', recentResponse.respondent_id);
      if (updErr) throw updErr;

      const resp = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId: id,
          respondentId: recentResponse.respondent_id,
          email,
          // (optional) include data the API might use to render the PDF:
          // categoryScores: getCategoryScores(),
          // userResponses: getTopResponses(),
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Failed to generate report');

      if (data?.serveUrl) setServeUrl(String(data.serveUrl));
      if (data?.emailMessage) setEmailMessage(String(data.emailMessage));
      setEmailSubmitted(true);
    } catch (err) {
      console.error(err);
      setEmailError(err.message || 'An error occurred.');
    } finally {
      setSubmittingEmail(false);
    }
  };

  const getScoreRange = (score, ranges) => {
    const pct = Math.round(score * 100);
    return ranges.find(r => pct >= r.min_score && pct <= r.max_score);
  };

  const categoryScores = getCategoryScores();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!survey) return <div>Survey not found</div>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto' }}>
      <h1>{survey.title || 'Survey Results'}</h1>
      {survey.description && <p style={{ color: '#666' }}>{survey.description}</p>}

      <h2>Category Scores</h2>
      <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
        {Object.entries(categoryScores).map(([category, score]) => {
          const cat = categories?.find(c => c.title === category);
          const ranges = scoreRanges.categories[cat?.id] || [];
          const range = getScoreRange(score, ranges);
          const percentage = Math.round(score * 100);
          
          return (
            <div
              key={category}
              style={{
                padding: '1.5rem',
                borderRadius: 8,
                backgroundColor: range ? `${range.color}20` : '#f8f9fa',
                borderLeft: range ? `4px solid ${range.color}` : '4px solid #ddd',
                border: '1px solid #e9ecef'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '1.1rem', color: '#333' }}>{category}</strong>
                <span style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold', 
                  color: range?.color || '#6c757d'
                }}>
                  {percentage}%
                </span>
              </div>
              {range && (
                <div style={{ 
                  color: '#555',
                  fontSize: '0.95rem',
                  lineHeight: '1.4'
                }}>
                  {range.description}
                </div>
              )}
              {!range && (
                <div style={{ 
                  color: '#999',
                  fontSize: '0.9rem',
                  fontStyle: 'italic'
                }}>
                  No description available for this score range.
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h2 style={{ marginTop: '2rem' }}>Request Detailed Report</h2>
      {emailSubmitted ? (
        <div style={{ padding: '1rem', background: '#d4edda', color: '#155724', borderRadius: 4 }}>
          Thank you! Your detailed report will be sent shortly.
          {emailMessage ? <div style={{ marginTop: 8 }}>{emailMessage}</div> : null}
          {serveUrl ? (
            <div style={{ marginTop: 8 }}>
              <a href={serveUrl} target="_blank" rel="noreferrer">View report</a>
            </div>
          ) : null}
        </div>
      ) : (
        <form onSubmit={handleEmailSubmit}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ padding: 8, width: '100%', maxWidth: 300 }}
          />
          {emailError && <div style={{ color: 'crimson' }}>{emailError}</div>}
          <button type="submit" disabled={submittingEmail} style={{ marginTop: 8, padding: '0.5rem 1rem' }}>
            {submittingEmail ? 'Submitting...' : 'Request Report'}
          </button>
        </form>
      )}

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button onClick={() => router.push('/surveys')} style={{ padding: '0.5rem 1rem' }}>
          Back to Surveys
        </button>
      </div>
    </div>
  );
}
