// comprehensive-test.js - Comprehensive test of database operations

const config = require('./config');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

async function testDatabaseOperations() {
  console.log('🧪 Starting comprehensive database tests...\n');
  
  try {
    // Test 1: Insert a test survey
    console.log('📝 Test 1: Inserting a test survey...');
    const { data: surveyData, error: surveyError } = await supabase
      .from('surveys')
      .insert({
        title: 'Test Survey',
        description: 'This is a test survey for validation',
        status: 'draft'
      })
      .select()
      .single();

    if (surveyError) {
      console.log('❌ Survey insertion failed:', surveyError);
      return false;
    }
    
    console.log('✅ Survey inserted successfully');
    console.log('   Survey ID:', surveyData.id);
    
    // Test 2: Insert a test category
    console.log('\n📝 Test 2: Inserting a test category...');
    const { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .insert({
        survey_id: surveyData.id,
        title: 'Test Category',
        description: 'This is a test category',
        weight: 1.0,
        order: 1
      })
      .select()
      .single();

    if (categoryError) {
      console.log('❌ Category insertion failed:', categoryError);
      return false;
    }
    
    console.log('✅ Category inserted successfully');
    console.log('   Category ID:', categoryData.id);
    
    // Test 3: Insert test questions
    console.log('\n📝 Test 3: Inserting test questions...');
    
    // Single choice question
    const { data: question1Data, error: question1Error } = await supabase
      .from('questions')
      .insert({
        category_id: categoryData.id,
        type: 'single',
        prompt: 'How satisfied are you with our service?',
        choices: JSON.stringify([
          { id: '1', label: 'Very Satisfied', value: 5 },
          { id: '2', label: 'Satisfied', value: 4 },
          { id: '3', label: 'Neutral', value: 3 },
          { id: '4', label: 'Dissatisfied', value: 2 },
          { id: '5', label: 'Very Dissatisfied', value: 1 }
        ]),
        max_score: 5,
        weight: 1.0,
        required: true,
        scorable: true,
        order: 1
      })
      .select()
      .single();

    if (question1Error) {
      console.log('❌ Question 1 insertion failed:', question1Error);
      return false;
    }
    
    console.log('✅ Question 1 inserted successfully');
    
    // Scale question
    const { data: question2Data, error: question2Error } = await supabase
      .from('questions')
      .insert({
        category_id: categoryData.id,
        type: 'scale',
        prompt: 'Rate our product from 1-10',
        choices: JSON.stringify([]),
        max_score: 10,
        weight: 1.0,
        required: true,
        scorable: true,
        order: 2
      })
      .select()
      .single();

    if (question2Error) {
      console.log('❌ Question 2 insertion failed:', question2Error);
      return false;
    }
    
    console.log('✅ Question 2 inserted successfully');
    
    // Test 4: Retrieve data
    console.log('\n📝 Test 4: Retrieving survey data...');
    const { data: retrievedSurvey, error: retrieveError } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', surveyData.id)
      .single();

    if (retrieveError) {
      console.log('❌ Survey retrieval failed:', retrieveError);
      return false;
    }
    
    console.log('✅ Survey retrieved successfully');
    console.log('   Retrieved survey title:', retrievedSurvey.title);
    
    // Test 5: Clean up test data
    console.log('\n📝 Test 5: Cleaning up test data...');
    const { error: cleanupError } = await supabase
      .from('questions')
      .delete()
      .in('category_id', [categoryData.id]);

    if (cleanupError) {
      console.log('⚠️  Question cleanup warning:', cleanupError);
    }
    
    const { error: categoryCleanupError } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryData.id);

    if (categoryCleanupError) {
      console.log('⚠️  Category cleanup warning:', categoryCleanupError);
    }
    
    const { error: surveyCleanupError } = await supabase
      .from('surveys')
      .delete()
      .eq('id', surveyData.id);

    if (surveyCleanupError) {
      console.log('⚠️  Survey cleanup warning:', surveyCleanupError);
    }
    
    console.log('✅ Test data cleaned up successfully');
    
    console.log('\n🎉 All database tests passed! Your Supabase connection is fully functional.');
    return true;
    
  } catch (err) {
    console.log('❌ Database test failed with exception:', err.message);
    return false;
  }
}

// Run the comprehensive test
testDatabaseOperations().then(success => {
  if (success) {
    console.log('\n✅ All tests completed successfully!');
  } else {
    console.log('\n❌ Some tests failed. Please check the errors above.');
  }
});
