import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';

const supabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
    : null;

/**
 * Upload a file to the public `assets` bucket and return the stored path.
 * Example stored path: surveys/<surveyId>/<uuid>.<ext>
 */
async function uploadQuestionImage(file, surveyId) {
  if (!supabase) throw new Error('No Supabase client');
  if (!file) throw new Error('No file provided');

  const uuid =
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : String(Date.now());

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `surveys/${surveyId}/${uuid}.${ext}`;

  const { error } = await supabase
    .storage
    .from('assets')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });

  if (error) throw error;
  return path; // save this into questions.image_path
}

export default function EditSurveyPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [survey, setSurvey] = useState({
    title: '',
    description: '',
    survey_footer: '', // ADDED
    status: 'draft'
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id) {
      fetchSurveyData();
    }
  }, [id]);

  const fetchSurveyData = async () => {
    if (!supabase) {
      setError('Database connection not available');
      setLoading(false);
      return;
    }

    try {
      // Fetch survey details
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', id)
        .single();

      if (surveyError) throw surveyError;
      
      setSurvey({
        title: surveyData.title,
        description: surveyData.description,
        survey_footer: surveyData.survey_footer || '', // ADDED
        status: surveyData.status
      });

      // Fetch categories with questions
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*, questions(*)')
        .eq('survey_id', id)
        .order('order');

      if (categoriesError) throw categoriesError;
      
      // Format categories and questions for the form
      const formattedCategories = (categoriesData || []).map(category => ({
        id: category.id,
        title: category.title,
        description: category.description,
        weight: category.weight,
        questions: (category.questions || []).map(question => {
          // Safely parse JSON fields with fallbacks
          let choices = [];
          let choiceScores = [];
          
          try {
            if (question.choices) {
              if (typeof question.choices === 'string') {
                if (question.choices.startsWith('{') && question.choices.endsWith('}')) {
                  const items = question.choices.substring(1, question.choices.length - 1).split(',');
                  choices = items.map(item => item.replace(/^"|"$/g, ''));
                } else {
                  choices = JSON.parse(question.choices);
                }
              } else if (Array.isArray(question.choices)) {
                choices = question.choices;
              }
            }
          } catch (e) {
            console.error('Error parsing choices:', e, question.choices);
            choices = [];
          }
          
          try {
            if (question.choice_scores) {
              if (typeof question.choice_scores === 'string') {
                if (question.choice_scores.startsWith('{') && question.choice_scores.endsWith('}')) {
                  const items = question.choice_scores.substring(1, question.choice_scores.length - 1).split(',');
                  choiceScores = items.map(item => parseInt(item) || 0);
                } else {
                  choiceScores = JSON.parse(question.choice_scores);
                }
              } else if (Array.isArray(question.choice_scores)) {
                choiceScores = question.choice_scores;
              }
            }
          } catch (e) {
            console.error('Error parsing choice_scores:', e, question.choice_scores);
            choiceScores = [];
          }
          
          if (!Array.isArray(choices)) choices = [];
          if (!Array.isArray(choiceScores)) choiceScores = [];
          
          if (choiceScores.length < choices.length) {
            choiceScores = [...choiceScores, ...Array(choices.length - choiceScores.length).fill(0)];
          }
          
          return {
            id: question.id,
            prompt: question.prompt,
            type: question.type,
            choices,
            choiceScores,
            maxScore: question.max_score,
            weight: question.weight,
            required: question.required,
            scorable: question.scorable,
            imagePath: question.image_path || '' // ADDED
          };
        })
      }));
      
      setCategories(formattedCategories);
    } catch (err) {
      console.error('Error in fetchSurveyData:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    if (!supabase) {
      setError('Database connection not available');
      setLoading(false);
      return;
    }
  
    try {
      // Update survey
      const { error: surveyError } = await supabase
        .from('surveys')
        .update({
          title: survey.title,
          description: survey.description,
          survey_footer: survey.survey_footer, // ADDED
          status: survey.status
        })
        .eq('id', id);

      if (surveyError) throw surveyError;

      // Update categories and questions
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        
        // Check if the category has an ID (exists in database) or not (new category)
        let categoryId;
        if (category.id) {
          // Update existing category
          const { data: updatedCategory, error: categoryError } = await supabase
            .from('categories')
            .update({
              title: category.title,
              description: category.description,
              weight: category.weight,
              order: i + 1
            })
            .eq('id', category.id)
            .select();

          if (categoryError) throw categoryError;
          categoryId = updatedCategory[0].id;
        } else {
          // Insert new category
          const { data: newCategory, error: categoryError } = await supabase
            .from('categories')
            .insert({
              title: category.title,
              description: category.description,
              weight: category.weight,
              order: i + 1,
              survey_id: id
            })
            .select();

          if (categoryError) throw categoryError;
          categoryId = newCategory[0].id;
        }

        // Process questions for this category
        for (let j = 0; j < category.questions.length; j++) {
          const question = category.questions[j];
          
          const choicesArray = `{${question.choices.map(choice => `"${choice.replace(/"/g, '\\"')}"`).join(',')}}`;
          const choiceScoresArray = `{${question.choiceScores.join(',')}}`;
          
          if (question.id) {
            // Update existing question
            const { error: questionError } = await supabase
              .from('questions')
              .update({
                prompt: question.prompt,
                type: question.type,
                choices: choicesArray,
                choice_scores: choiceScoresArray,
                max_score: question.maxScore,
                weight: question.weight,
                required: question.required,
                scorable: question.scorable,
                order: j + 1,
                image_path: question.imagePath || null // ADDED
              })
              .eq('id', question.id);

            if (questionError) throw questionError;
          } else {
            // Insert new question
            const { error: questionError } = await supabase
              .from('questions')
              .insert({
                prompt: question.prompt,
                type: question.type,
                choices: choicesArray,
                choice_scores: choiceScoresArray,
                max_score: question.maxScore,
                weight: question.weight,
                required: question.required,
                scorable: question.scorable,
                order: j + 1,
                category_id: categoryId,
                image_path: question.imagePath || null // ADDED
              });

            if (questionError) throw questionError;
          }
        }
      }

      router.push('/admin/dashboard');
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Helper functions for managing categories and questions
  const addCategory = () => {
    setCategories([...categories, {
      title: '',
      description: '',
      weight: 1,
      questions: []
    }]);
  };

  const removeCategory = (index) => {
    const newCategories = [...categories];
    newCategories.splice(index, 1);
    setCategories(newCategories);
  };

  const updateCategory = (index, field, value) => {
    const newCategories = [...categories];
    newCategories[index] = { ...newCategories[index], [field]: value };
    setCategories(newCategories);
  };

  const addQuestion = (categoryIndex) => {
    const newCategories = [...categories];
    newCategories[categoryIndex].questions.push({
      prompt: '',
      type: 'text',
      choices: [],
      choiceScores: [],
      maxScore: 5,
      weight: 1,
      required: true,
      scorable: true,
      imagePath: '' // ADDED
    });
    setCategories(newCategories);
  };

  const removeQuestion = (categoryIndex, questionIndex) => {
    const newCategories = [...categories];
    newCategories[categoryIndex].questions.splice(questionIndex, 1);
    setCategories(newCategories);
  };

  const updateQuestion = (categoryIndex, questionIndex, field, value) => {
    const newCategories = [...categories];
    newCategories[categoryIndex].questions[questionIndex] = { 
      ...newCategories[categoryIndex].questions[questionIndex], 
      [field]: value 
    };
    setCategories(newCategories);
  };

  const updateQuestionChoice = (categoryIndex, questionIndex, choiceIndex, value) => {
    const newCategories = [...categories];
    const newChoices = [...newCategories[categoryIndex].questions[questionIndex].choices];
    newChoices[choiceIndex] = value;
    newCategories[categoryIndex].questions[questionIndex].choices = newChoices;
    setCategories(newCategories);
  };

  const updateQuestionChoiceScore = (categoryIndex, questionIndex, choiceIndex, value) => {
    const newCategories = [...categories];
    const newChoiceScores = [...newCategories[categoryIndex].questions[questionIndex].choiceScores];
    newChoiceScores[choiceIndex] = parseInt(value) || 0;
    newCategories[categoryIndex].questions[questionIndex].choiceScores = newChoiceScores;
    setCategories(newCategories);
  };

  const addQuestionChoice = (categoryIndex, questionIndex) => {
    const newCategories = [...categories];
    newCategories[categoryIndex].questions[questionIndex].choices.push('');
    newCategories[categoryIndex].questions[questionIndex].choiceScores.push(0);
    setCategories(newCategories);
  };

  const removeQuestionChoice = (categoryIndex, questionIndex, choiceIndex) => {
    const newCategories = [...categories];
    const newChoices = [...newCategories[categoryIndex].questions[questionIndex].choices];
    const newChoiceScores = [...newCategories[categoryIndex].questions[questionIndex].choiceScores];
    newChoices.splice(choiceIndex, 1);
    newChoiceScores.splice(choiceIndex, 1);
    newCategories[categoryIndex].questions[questionIndex].choices = newChoices;
    newCategories[categoryIndex].questions[questionIndex].choiceScores = newChoiceScores;
    setCategories(newCategories);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Edit Survey</h1>
      
      <form onSubmit={handleSubmit}>
        {/* Survey details form */}
        <div style={{ marginBottom: '2rem' }}>
          <h2>Survey Details</h2>
          <div style={{ marginBottom: '1rem' }}>
            <label>Title:</label>
            <input
              type="text"
              value={survey.title}
              onChange={(e) => setSurvey({...survey, title: e.target.value})}
              style={{ width: '100%', padding: '0.75rem' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>Description:</label>
            <textarea
              value={survey.description}
              onChange={(e) => setSurvey({...survey, description: e.target.value})}
              style={{ width: '100%', padding: '0.75rem', minHeight: '100px' }}
            />
          </div>

          {/* Survey footer field (between Description and Status) */}
          <div style={{ marginBottom: '1rem' }}>
            <label>Survey footer:</label>
            <input
              type="text"
              value={survey.survey_footer}
              onChange={(e) => setSurvey({ ...survey, survey_footer: e.target.value })}
              style={{ width: '100%', padding: '0.75rem' }}
              placeholder="© 2025 Your org — All rights reserved"
            />
          </div>

          <div>
            <label>Status:</label>
            <select
              value={survey.status}
              onChange={(e) => setSurvey({...survey, status: e.target.value})}
              style={{ width: '100%', padding: '0.75rem' }}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
        
        {/* Categories and questions form */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>Categories & Questions</h2>
            <button
              type="button"
              onClick={addCategory}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Add Category
            </button>
          </div>
          
          {categories.map((category, categoryIndex) => (
            <div key={categoryIndex} style={{ border: '1px solid #ddd', padding: '1rem', marginBottom: '1rem', borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>Category {categoryIndex + 1}</h3>
                <button
                  type="button"
                  onClick={() => removeCategory(categoryIndex)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Remove
                </button>
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label>Title:</label>
                <input
                  type="text"
                  value={category.title}
                  onChange={(e) => updateCategory(categoryIndex, 'title', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label>Description:</label>
                <textarea
                  value={category.description}
                  onChange={(e) => updateCategory(categoryIndex, 'description', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', minHeight: '60px' }}
                />
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label>Weight:</label>
                <input
                  type="number"
                  min="1"
                  value={category.weight}
                  onChange={(e) => updateCategory(categoryIndex, 'weight', parseInt(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4>Questions</h4>
                  <button
                    type="button"
                    onClick={() => addQuestion(categoryIndex)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Add Question
                  </button>
                </div>
                
                {category.questions.map((question, questionIndex) => (
                  <div key={questionIndex} style={{ border: '1px solid #eee', padding: '1rem', marginBottom: '1rem', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <h5>Question {questionIndex + 1}</h5>
                      <button
                        type="button"
                        onClick={() => removeQuestion(categoryIndex, questionIndex)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    
                    <div style={{ marginBottom: '0.5rem' }}>
                      <label>Prompt:</label>
                      <input
                        type="text"
                        value={question.prompt}
                        onChange={(e) => updateQuestion(categoryIndex, questionIndex, 'prompt', e.target.value)}
                        style={{ width: '100%', padding: '0.5rem' }}
                      />
                    </div>
                    
                    <div style={{ marginBottom: '0.5rem' }}>
                      <label>Type:</label>
                      <select
                        value={question.type}
                        onChange={(e) => updateQuestion(categoryIndex, questionIndex, 'type', e.target.value)}
                        style={{ width: '100%', padding: '0.5rem' }}
                      >
                        <option value="text">Text</option>
                        <option value="textarea">Textarea</option>
                        <option value="radio">Radio</option>
                        <option value="checkbox">Checkbox</option>
                        <option value="select">Select</option>
                        <option value="rating">Rating</option>
                      </select>
                    </div>
                    
                    {(question.type === 'radio' || question.type === 'checkbox' || question.type === 'select') && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <label>Choices:</label>
                        {question.choices.map((choice, choiceIndex) => (
                          <div key={choiceIndex} style={{ display: 'flex', marginBottom: '0.25rem', gap: '0.5rem' }}>
                            <input
                              type="text"
                              value={choice}
                              onChange={(e) => updateQuestionChoice(categoryIndex, questionIndex, choiceIndex, e.target.value)}
                              style={{ flex: 2, padding: '0.5rem' }}
                              placeholder="Choice text"
                            />
                            <input
                              type="number"
                              value={question.choiceScores[choiceIndex] || 0}
                              onChange={(e) => updateQuestionChoiceScore(categoryIndex, questionIndex, choiceIndex, e.target.value)}
                              style={{ flex: 1, padding: '0.5rem' }}
                              placeholder="Score"
                              min="0"
                            />
                            <button
                              type="button"
                              onClick={() => removeQuestionChoice(categoryIndex, questionIndex, choiceIndex)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addQuestionChoice(categoryIndex, questionIndex)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#17a2b8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Add Choice
                        </button>
                      </div>
                    )}

                    {/* Question image upload (png/jpg) */}
                    <div style={{ marginTop: '0.5rem' }}>
                      <label style={{ display: 'block', marginBottom: 4 }}>Question image (png/jpg):</label>
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const path = await uploadQuestionImage(file, id); // survey id from URL
                            const newCategories = [...categories];
                            newCategories[categoryIndex].questions[questionIndex].imagePath = path;
                            setCategories(newCategories);
                          } catch (err) {
                            console.error('Upload failed', err);
                            alert('Image upload failed: ' + (err?.message || 'Unknown error'));
                          }
                        }}
                      />
                      {question.imagePath ? (
                        <div style={{ marginTop: 6, fontSize: 12, color: '#555' }}>
                          Stored as: {question.imagePath}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
