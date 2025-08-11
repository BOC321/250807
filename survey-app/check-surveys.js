// Simple script to check available surveys
const config = require('./config');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

async function checkSurveys() {
  try {
    console.log('Checking for published surveys...');
    
    const { data, error } = await supabase
      .from('surveys')
      .select('*')
      .eq('status', 'published');
    
    if (error) {
      console.error('Error fetching surveys:', error);
      return;
    }
    
    console.log('Published surveys found:', data?.length || 0);
    
    if (data && data.length > 0) {
      data.forEach((survey, index) => {
        console.log(`\nSurvey ${index + 1}:`);
        console.log(`  ID: ${survey.id}`);
        console.log(`  Title: ${survey.title}`);
        console.log(`  Description: ${survey.description}`);
        console.log(`  Status: ${survey.status}`);
        console.log(`  URL: http://localhost:3001/surveys/take/${survey.id}`);
      });
    } else {
      console.log('No published surveys found.');
      console.log('You may need to publish a survey first or check the database.');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkSurveys();
