import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : null;

/**
 * ScoreRangesManager Component
 * Props:
 * - surveyId (string): ID of the survey
 * - categories (array, optional): List of category objects { id, title }
 */
const ScoreRangesManager = ({ surveyId, categories }) => {
  console.log('ScoreRangesManager: Rendering with props:', { surveyId, categories });
  
  const [localCategories, setLocalCategories] = useState(() => {
    console.log('ScoreRangesManager: Initializing localCategories with:', categories);
    return Array.isArray(categories) ? categories : [];
  });
  const [scoreRanges, setScoreRanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('total');
  const [newRange, setNewRange] = useState({
    minScore: '',
    maxScore: '',
    color: '#3B82F6',
    description: '',
  });
  const [editingRange, setEditingRange] = useState(null);

  // Fetch categories if not provided
  useEffect(() => {
    console.log('ScoreRangesManager: useEffect for categories triggered', { surveyId, categories: categories?.length });
    
    if (!supabase || !surveyId) {
      console.log('ScoreRangesManager: Missing supabase or surveyId', { supabase: !!supabase, surveyId });
      setError('Missing required configuration');
      setLoading(false);
      return;
    }

    if (categories && Array.isArray(categories) && categories.length) {
      console.log('ScoreRangesManager: Using provided categories', categories);
      setLocalCategories(categories);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        console.log('ScoreRangesManager: Fetching categories for survey', surveyId);
        const { data, error } = await supabase
          .from('categories')
          .select('id, title')
          .eq('survey_id', surveyId)
          .order('order', { ascending: true });

        if (!cancelled) {
          if (error) {
            console.error('Error fetching categories:', error);
            setError(`Failed to load categories: ${error.message}`);
          } else {
            console.log('ScoreRangesManager: Loaded categories', data);
            setLocalCategories(data || []);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Exception fetching categories:', err);
          setError(`Failed to load categories: ${err.message}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [surveyId, categories]);

  // Fetch score ranges when surveyId or selectedCategory changes
  useEffect(() => {
    fetchScoreRanges();
  }, [surveyId, selectedCategory]);

  const fetchScoreRanges = async () => {
    if (!surveyId) {
      console.log('ScoreRangesManager: No surveyId provided for fetchScoreRanges');
      setError('No survey ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('ScoreRangesManager: Fetching ranges for', { surveyId, selectedCategory });
      
      if (!supabase) {
        throw new Error('Supabase client not initialized. Please check environment variables.');
      }

      let query = supabase
        .from('score_ranges')
        .select('*')
        .eq('survey_id', surveyId);

      if (selectedCategory !== 'total') {
        console.log('ScoreRangesManager: Filtering by category_id:', selectedCategory);
        query = query.eq('category_id', selectedCategory);
      } else {
        console.log('ScoreRangesManager: Filtering for total score (category_id is null)');
        query = query.is('category_id', null);
      }

      console.log('ScoreRangesManager: Executing query...');
      const { data, error } = await query.order('min_score', { ascending: true });
      
      if (error) {
        console.error('ScoreRangesManager: Query error:', error);
        throw error;
      }
      
      console.log('ScoreRangesManager: Query successful, loaded ranges:', data);
      setScoreRanges(data || []);
    } catch (err) {
      console.error('Error fetching score ranges:', err);
      setError(`Failed to load score ranges: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Placeholder: Add, edit, delete, and validation handlers go here…

  const handleAddRange = async () => {
    try {
      // Validate input
      if (!newRange.minScore || !newRange.maxScore || !newRange.description) {
        setError('Please fill in all fields');
        return;
      }
      
      if (!supabase) {
        setError('Supabase client not initialized. Please check environment variables.');
        return;
      }
      
      const minScore = parseInt(newRange.minScore);
      const maxScore = parseInt(newRange.maxScore);
      
      if (minScore >= maxScore) {
        setError('Maximum score must be greater than minimum score');
        return;
      }
      
      // Check for overlaps
      const hasOverlap = scoreRanges.some(range => 
        (minScore >= range.min_score && minScore < range.max_score) ||
        (maxScore > range.min_score && maxScore <= range.max_score) ||
        (minScore <= range.min_score && maxScore >= range.max_score)
      );
      
      if (hasOverlap) {
        setError('This range overlaps with an existing range');
        return;
      }
      
      const { data, error } = await supabase
        .from('score_ranges')
        .insert([{
          survey_id: surveyId,
          category_id: selectedCategory === 'total' ? null : selectedCategory,
          min_score: minScore,
          max_score: maxScore,
          color: newRange.color,
          description: newRange.description
        }])
        .select();
      
      if (error) throw error;
      
      // Update the local state
      const updatedRanges = [...scoreRanges, data[0]];
      setScoreRanges(updatedRanges);
      
      // Check if there are gaps and show a warning
      const hasGaps = checkForGaps(updatedRanges);
      if (hasGaps) {
        setError('Warning: There are gaps in the 0-100% spectrum. Please add more ranges to eliminate gaps.');
      } else {
        setError(null);
      }
      
      // Reset the form
      setNewRange({
        minScore: '',
        maxScore: '',
        color: '#3B82F6',
        description: ''
      });
    } catch (err) {
      console.error('Error adding score range:', err);
      setError(err.message);
    }
  };

  const handleDeleteRange = async (id) => {
    try {
      if (!supabase) {
        setError('Supabase client not initialized. Please check environment variables.');
        return;
      }
      
      const { error } = await supabase
        .from('score_ranges')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Update the local state
      const updatedRanges = scoreRanges.filter(range => range.id !== id);
      setScoreRanges(updatedRanges);
      
      // Check if there are now gaps and show a warning
      const hasGaps = checkForGaps(updatedRanges);
      if (hasGaps && updatedRanges.length > 0) {
        setError('Warning: Deleting this range has created gaps in the 0-100% spectrum. Please add or adjust ranges to eliminate gaps.');
      } else {
        setError(null);
      }
    } catch (err) {
      console.error('Error deleting score range:', err);
      setError(err.message);
    }
  };

  const getCategoryName = (categoryId) => {
    if (!categoryId) return 'Total Score';
    const category = localCategories.find(c => c.id === categoryId);
    return category ? category.title : 'Unknown Category';
  };

  const checkForGaps = (ranges) => {
    if (ranges.length === 0) return true; // No ranges means there's a gap
    
    // Sort ranges by min_score
    const sortedRanges = [...ranges].sort((a, b) => a.min_score - b.min_score);
    
    // Check if the first range starts at 0
    if (sortedRanges[0].min_score > 0) {
      return true; // Gap from 0 to the first range
    }
    
    // Check for gaps between ranges
    for (let i = 0; i < sortedRanges.length - 1; i++) {
      // If the next range doesn't start at or immediately after the current range ends, there's a gap
      if (sortedRanges[i].max_score < sortedRanges[i + 1].min_score - 1) {
        return true; // Gap between this range and the next
      }
    }
    
    // Check if the last range ends at 100
    if (sortedRanges[sortedRanges.length - 1].max_score < 100) {
      return true; // Gap from the last range to 100
    }
    
    return false; // No gaps found
  };

  const renderCoverageStatus = () => {
    const hasGaps = checkForGaps(scoreRanges);
    
    return (
      <div style={{ 
        marginBottom: '1rem', 
        padding: '0.75rem', 
        borderRadius: '4px',
        backgroundColor: hasGaps ? '#f8d7da' : '#d4edda',
        color: hasGaps ? '#721c24' : '#155724',
        border: `1px solid ${hasGaps ? '#f5c6cb' : '#c3e6cb'}`
      }}>
        {hasGaps 
          ? '⚠️ The current ranges do not cover the entire 0-100% spectrum. Please add or adjust ranges to eliminate gaps.'
          : '✅ The current ranges cover the entire 0-100% spectrum without gaps.'
        }
      </div>
    );
  };

  return (
    <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '2rem' }}>
      <h2>Score Ranges</h2>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="category-select" style={{ display: 'block', marginBottom: '0.5rem' }}>
          Select Category:
        </label>
        <select
          id="category-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option value="total">Total Score</option>
          {(localCategories || []).map((category) => (
            <option key={category?.id || 'unknown'} value={category?.id || ''}>
              {category?.title || 'Untitled Category'}
            </option>
          ))}
        </select>
      </div>

      {/* Add the coverage status indicator */}
      {!loading && scoreRanges.length > 0 && renderCoverageStatus()}

      {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div>Loading score ranges...</div>
          <div style={{ fontSize: '0.8em', color: '#666', marginTop: '0.5rem' }}>
            Survey: {surveyId} | Category: {selectedCategory}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <h3>Add New Range</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr auto', gap: '0.5rem', alignItems: 'center' }}>
              <div>
                <label htmlFor="min-score" style={{ display: 'block', marginBottom: '0.25rem' }}>
                  Min Score (%):
                </label>
                <input
                  id="min-score"
                  type="number"
                  min="0"
                  max="99"
                  value={newRange.minScore}
                  onChange={(e) => setNewRange({...newRange, minScore: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label htmlFor="max-score" style={{ display: 'block', marginBottom: '0.25rem' }}>
                  Max Score (%):
                </label>
                <input
                  id="max-score"
                  type="number"
                  min="1"
                  max="100"
                  value={newRange.maxScore}
                  onChange={(e) => setNewRange({...newRange, maxScore: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label htmlFor="color" style={{ display: 'block', marginBottom: '0.25rem' }}>
                  Color:
                </label>
                <input
                  id="color"
                  type="color"
                  value={newRange.color}
                  onChange={(e) => setNewRange({...newRange, color: e.target.value})}
                  style={{ width: '100%', height: '38px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label htmlFor="description" style={{ display: 'block', marginBottom: '0.25rem' }}>
                  Description:
                </label>
                <textarea
                  id="description"
                  value={newRange.description}
                  onChange={(e) => setNewRange({...newRange, description: e.target.value})}
                  style={{ 
                    width: '100%', 
                    padding: '0.5rem', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px',
                    resize: 'vertical',
                    minHeight: '38px',
                    fontFamily: 'inherit'
                  }}
                  rows="2"
                  placeholder="Enter description (press Enter for new lines)"
                />
              </div>
              <div>
                <button
                  onClick={handleAddRange}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginTop: '1.5rem'
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3>Existing Ranges</h3>
            {scoreRanges.length === 0 ? (
              <p>No score ranges defined for {getCategoryName(selectedCategory)}</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'left' }}>Min Score</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'left' }}>Max Score</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'left' }}>Color</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'left' }}>Description</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.5rem', textAlign: 'left' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreRanges && scoreRanges.map(range => (
                    <tr key={range.id}>
                      <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>
                        {range.min_score}%
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>
                        {range.max_score}%
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div 
                            style={{ 
                              width: '20px', 
                              height: '20px', 
                              backgroundColor: range.color, 
                              marginRight: '0.5rem',
                              border: '1px solid #ddd'
                            }}
                          ></div>
                          {range.color}
                        </div>
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          {range.description}
                        </div>
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>
                        <button
                          onClick={() => handleDeleteRange(range.id)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoreRangesManager;