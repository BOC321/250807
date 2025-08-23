// pages/admin/surveys/create.js

import { useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  : null;

export default function CreateSurvey() {
  const router = useRouter();
  const [survey, setSurvey] = useState({
    title: '',
    description: '',
    status: 'draft'
  });
  
  const [categories, setCategories] = useState([
    {
      id: Date.now().toString(),
      title: '',
      description: '',
      weight: 1.0,
      order: 1,
      questions: [
        {
          id: Date.now().toString(),
          type: 'single',
          prompt: '',
          choices: [
            { id: '1', label: '', value: 0 },
            { id: '2', label: '', value: 1 }
          ],
          maxScore: 1,
          weight: 1.0,
          required: false,
          scorable: true,
          imageUrl: '',
          helpText: '',
          order: 1
        }
      ]
    }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);

  const addCategory = () => {
    const newCategory = {
      id: Date.now().toString(),
      title: '',
      description: '',
      weight: 1.0,
      order: categories.length + 1,
      questions: [
        {
          id: Date.now().toString(),
          type: 'single',
          prompt: '',
          choices: [
            { id: '1', label: '', value: 0 },
            { id: '2', label: '', value: 1 }
          ],
          maxScore: 1,
          weight: 1.0,
          required: false,
          scorable: true,
          imageUrl: '',
          helpText: '',
          order: 1
        }
      ]
    };
    setCategories([...categories, newCategory]);
    setActiveCategory(categories.length);
  };

  const removeCategory = (categoryId) => {
    if (categories.length > 1) {
      setCategories(categories.filter(cat => cat.id !== categoryId));
      if (activeCategory >= categories.length - 1) {
        setActiveCategory(categories.length - 2);
      }
    }
  };

  const addQuestion = (categoryId) => {
    const updatedCategories = categories.map(cat => {
      if (cat.id === categoryId) {
        const newQuestion = {
          id: Date.now().toString(),
          type: 'single',
          prompt: '',
          choices: [
            { id: '1', label: '', value: 0 },
            { id: '2', label: '', value: 1 }
          ],
          maxScore: 1,
          weight: 1.0,
          required: false,
          scorable: true,
          imageUrl: '',
          helpText: '',
          order: cat.questions.length + 1
        };
        return { ...cat, questions: [...cat.questions, newQuestion] };
      }
      return cat;
    });
    setCategories(updatedCategories);
  };

  const removeQuestion = (categoryId, questionId) => {
    const updatedCategories = categories.map(cat => {
      if (cat.id === categoryId) {
        const updatedQuestions = cat.questions.filter(q => q.id !== questionId);
        return { ...cat, questions: updatedQuestions };
      }
      return cat;
    });
    setCategories(updatedCategories);
  };

  const addChoice = (categoryId, questionId) => {
    const updatedCategories = categories.map(cat => {
      if (cat.id === categoryId) {
        const updatedQuestions = cat.questions.map(q => {
          if (q.id === questionId) {
            const newChoice = {
              id: Date.now().toString(),
              label: '',
              value: Math.max(...q.choices.map(c => c.value), 0) + 1
            };
            return { ...q, choices: [...q.choices, newChoice] };
          }
          return q;
        });
        return { ...cat, questions: updatedQuestions };
      }
      return cat;
    });
    setCategories(updatedCategories);
  };

  const removeChoice = (categoryId, questionId, choiceId) => {
    const updatedCategories = categories.map(cat => {
      if (cat.id === categoryId) {
        const updatedQuestions = cat.questions.map(q => {
          if (q.id === questionId) {
            const updatedChoices = q.choices.filter(c => c.id !== choiceId);
            return { ...q, choices: updatedChoices };
          }
          return q;
        });
        return { ...cat, questions: updatedQuestions };
      }
      return cat;
    });
    setCategories(updatedCategories);
  };

  const updateSurvey = (field, value) => {
    setSurvey({ ...survey, [field]: value });
  };

  const updateCategory = (categoryId, field, value) => {
    const updatedCategories = categories.map(cat => {
      if (cat.id === categoryId) {
        return { ...cat, [field]: value };
      }
      return cat;
    });
    setCategories(updatedCategories);
  };

  const updateQuestion = (categoryId, questionId, field, value) => {
    const updatedCategories = categories.map(cat => {
      if (cat.id === categoryId) {
        const updatedQuestions = cat.questions.map(q => {
          if (q.id === questionId) {
            if (field === 'type' && value === 'scale') {
              // For scale questions, reset choices to empty array
              return { ...q, type: value, choices: [] };
            }
            if (field === 'type' && value === 'text') {
              // For text questions, reset choices to empty and make non-scorable
              return { ...q, type: value, choices: [], scorable: false };
            }
            if (field === 'choices') {
              return { ...q, [field]: value };
            }
            return { ...q, [field]: value };
          }
          return q;
        });
        return { ...cat, questions: updatedQuestions };
      }
      return cat;
    });
    setCategories(updatedCategories);
  };

  const updateChoice = (categoryId, questionId, choiceId, field, value) => {
    const updatedCategories = categories.map(cat => {
      if (cat.id === categoryId) {
        const updatedQuestions = cat.questions.map(q => {
          if (q.id === questionId) {
            const updatedChoices = q.choices.map(c => {
              if (c.id === choiceId) {
                return { ...c, [field]: field === 'value' ? parseFloat(value) || 0 : value };
              }
              return c;
            });
            return { ...q, choices: updatedChoices };
          }
          return q;
        });
        return { ...cat, questions: updatedQuestions };
      }
      return cat;
    });
    setCategories(updatedCategories);
  };

  const validateSurvey = () => {
    if (!survey.title.trim()) {
      setError('Survey title is required');
      return false;
    }

    for (const category of categories) {
      if (!category.title.trim()) {
        setError('All categories must have titles');
        return false;
      }

      for (const question of category.questions) {
        if (!question.prompt.trim()) {
          setError('All questions must have prompts');
          return false;
        }

        if ((question.type === 'single' || question.type === 'multi') && question.choices.length < 2) {
          setError(`Question "${question.prompt}" must have at least 2 choices`);
          return false;
        }

        if (question.maxScore <= 0 && question.scorable) {
          setError(`Question "${question.prompt}" must have a positive max score`);
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateSurvey()) {
      return;
    }

    if (!supabase) {
      setError('Database connection not available');
      return;
    }

    setLoading(true);

    try {
      // Create the survey
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .insert({
          title: survey.title,
          description: survey.description,
          status: survey.status
        })
        .select()
        .single();

      if (surveyError) throw surveyError;

      // Create categories and questions
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        
        const { data: categoryData, error: categoryError } = await supabase
          .from('categories')
          .insert({
            survey_id: surveyData.id,
            title: category.title,
            description: category.description,
            weight: category.weight,
            order: i + 1
          })
          .select()
          .single();

        if (categoryError) throw categoryError;

        // Create questions for this category
        for (let j = 0; j < category.questions.length; j++) {
          const question = category.questions[j];
          
          const { error: questionError } = await supabase
            .from('questions')
            .insert({
              category_id: categoryData.id,
              type: question.type,
              prompt: question.prompt,
              choices: JSON.stringify(question.choices),
              max_score: question.maxScore,
              weight: question.weight,
              required: question.required,
              scorable: question.scorable,
              image_url: question.imageUrl || null,
              help_text: question.helpText || null,
              order: j + 1
            });

          if (questionError) throw questionError;
        }
      }

      alert('Survey created successfully!');
      router.push('/admin/dashboard');

    } catch (error) {
      console.error('Error creating survey:', error);
      setError('Failed to create survey: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderQuestion = (category, question) => {
    const questionId = question.id;
    const categoryId = category.id;

    return (
      <div key={questionId} style={{ 
        padding: '1rem', 
        border: '1px solid #ddd', 
        borderRadius: '4px', 
        marginBottom: '1rem',
        backgroundColor: '#f9f9f9'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4>Question</h4>
          <button
            onClick={() => removeQuestion(categoryId, questionId)}
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
          <textarea
            value={question.prompt}
            onChange={(e) => updateQuestion(categoryId, questionId, 'prompt', e.target.value)}
            placeholder="Enter the question text"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', minHeight: '60px' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label>Type:</label>
            <select
              value={question.type}
              onChange={(e) => updateQuestion(categoryId, questionId, 'type', e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="single">Single Choice</option>
              <option value="multi">Multiple Choice</option>
              <option value="scale">Scale</option>
              <option value="text">Text</option>
            </select>
          </div>

          <div>
            <label>Max Score:</label>
            <input
              type="number"
              value={question.maxScore}
              onChange={(e) => updateQuestion(categoryId, questionId, 'maxScore', parseFloat(e.target.value))}
              min="0"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label>Weight:</label>
            <input
              type="number"
              value={question.weight}
              onChange={(e) => updateQuestion(categoryId, questionId, 'weight', parseFloat(e.target.value))}
              step="0.1"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <label>
            <input
              type="checkbox"
              checked={question.required}
              onChange={(e) => updateQuestion(categoryId, questionId, 'required', e.target.checked)}
            />
            Required
          </label>
          <label>
            <input
              type="checkbox"
              checked={question.scorable}
              onChange={(e) => updateQuestion(categoryId, questionId, 'scorable', e.target.checked)}
            />
            Scorable
          </label>
        </div>

        <div style={{ marginBottom: '0.5rem' }}>
          <label>Help Text:</label>
          <input
            type="text"
            value={question.helpText}
            onChange={(e) => updateQuestion(categoryId, questionId, 'helpText', e.target.value)}
            placeholder="Optional help text for respondents"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>

        {(question.type === 'single' || question.type === 'multi') && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h5>Choices:</h5>
              <button
                onClick={() => addChoice(categoryId, questionId)}
                style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Add Choice
              </button>
            </div>
            {question.choices.map((choice) => (
              <div key={choice.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={choice.label}
                  onChange={(e) => updateChoice(categoryId, questionId, choice.id, 'label', e.target.value)}
                  placeholder="Choice label"
                  style={{ padding: '0.25rem', border: '1px solid #ddd', borderRadius: '4px', flex: 1 }}
                />
                <input
                  type="number"
                  value={choice.value}
                  onChange={(e) => updateChoice(categoryId, questionId, choice.id, 'value', e.target.value)}
                  placeholder="Value"
                  style={{ width: '80px', padding: '0.25rem', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <button
                  onClick={() => removeChoice(categoryId, questionId, choice.id)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem' 
      }}>
        <h1>Create New Survey</h1>
        <button 
          onClick={() => router.push('/admin/dashboard')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Back to Dashboard
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Survey Details */}
        <div style={{ marginBottom: '2rem' }}>
          <h2>Survey Details</h2>
          <div style={{ marginBottom: '1rem' }}>
            <label>Title:</label>
            <input
              type="text"
              value={survey.title}
              onChange={(e) => updateSurvey('title', e.target.value)}
              placeholder="Enter survey title"
              required
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>Description:</label>
            <textarea
              value={survey.description}
              onChange={(e) => updateSurvey('description', e.target.value)}
              placeholder="Survey description"
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', minHeight: '100px' }}
            />
          </div>
          <div>
            <label>Status:</label>
            <select
              value={survey.status}
              onChange={(e) => updateSurvey('status', e.target.value)}
              style={{ padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Category Tabs */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>Categories</h2>
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

          {/* Category Navigation */}
          <div style={{ display: 'flex', borderBottom: '2px solid #ddd', marginBottom: '1rem' }}>
            {categories.map((category, index) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(index)}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  backgroundColor: activeCategory === index ? '#f8f9fa' : 'transparent',
                  borderBottom: activeCategory === index ? '2px solid #0070f3' : '2px solid transparent',
                  cursor: 'pointer',
                  marginBottom: '-2px'
                }}
              >
                Category {index + 1}
                {categories.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeCategory(category.id); }}
                    style={{
                      marginLeft: '0.5rem',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    ×
                  </button>
                )}
              </button>
            ))}
          </div>

          {/* Category Content */}
          {categories.map((category, categoryIndex) => (
            <div key={category.id} style={{ display: activeCategory === categoryIndex ? 'block' : 'none' }}>
              <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label>Category Title:</label>
                    <input
                      type="text"
                      value={category.title}
                      onChange={(e) => updateCategory(category.id, 'title', e.target.value)}
                      placeholder="Enter category title"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                  </div>
                  <div>
                    <label>Weight:</label>
                    <input
                      type="number"
                      value={category.weight}
                      onChange={(e) => updateCategory(category.id, 'weight', parseFloat(e.target.value))}
                      step="0.1"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label>Description:</label>
                  <textarea
                    value={category.description}
                    onChange={(e) => updateCategory(category.id, 'description', e.target.value)}
                    placeholder="Category description"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', minHeight: '60px' }}
                  />
                </div>

                {/* Questions for this category */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4>Questions</h4>
                  <button
                    type="button"
                    onClick={() => addQuestion(category.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#0070f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Add Question
                  </button>
                </div>

                {category.questions.map(question => renderQuestion(category, question))}
              </div>
            </div>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div style={{ 
            color: 'red', 
            marginBottom: '1rem', 
            padding: '1rem', 
            border: '1px solid #dc3545', 
            borderRadius: '4px', 
            backgroundColor: '#f8d7da' 
          }}>
            {error}
          </div>
        )}

        {/* Submit Button */}
        <div style={{ textAlign: 'center' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '1rem 2rem',
              backgroundColor: loading ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Creating Survey...' : 'Create Survey'}
          </button>
        </div>
      </form>
    </div>
  );
}
