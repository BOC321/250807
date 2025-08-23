const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStorageUpload() {
  try {
    // Create a test PDF file
    const testContent = 'This is a test PDF file';
    const fileName = `test-upload-${uuidv4()}.pdf`;
    fs.writeFileSync(fileName, testContent);

    // Read the file back
    const fileBuffer = fs.readFileSync(fileName);
    
    console.log('Attempting upload to Supabase storage...');
    
    // Upload to storage
    const { data, error } = await supabase.storage
      .from('survey-reports')
      .upload(fileName, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (error) {
      console.error('❌ Upload failed:', error);
      return false;
    }

    console.log('✅ Upload successful:', data);
    console.log(`File URL: ${supabaseUrl}/storage/v1/object/public/survey-reports/${fileName}`);
    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

testStorageUpload().then(success => {
  if (success) {
    console.log('Test completed successfully');
  } else {
    console.log('Test failed');
    process.exit(1);
  }
});
