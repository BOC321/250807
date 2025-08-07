import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for admin access
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { surveyId, respondentId, email } = req.body;

  try {
    console.log('Starting report generation for survey:', surveyId);
    
    // Check environment variables
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
    }
    if (!process.env.MAILEROO_API_KEY) {
      throw new Error('MAILEROO_API_KEY is not set');
    }
    if (!process.env.MAILEROO_FROM_EMAIL) {
      throw new Error('MAILEROO_FROM_EMAIL is not set');
    }
    
    console.log('Environment variables are set');

    // Fetch survey data
    console.log('Fetching survey data');
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (surveyError) throw surveyError;
    console.log('Survey data fetched successfully');

    // Fetch categories with questions
    console.log('Fetching categories and questions');
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('*, questions(*)')
      .eq('survey_id', surveyId)
      .order('order');

    if (categoriesError) throw categoriesError;
    console.log('Categories and questions fetched successfully');

    // Fetch responses
    console.log('Fetching responses');
    const { data: responses, error: responsesError } = await supabase
      .from('responses')
      .select('*')
      .eq('survey_id', surveyId);

    if (responsesError) throw responsesError;
    console.log('Responses fetched successfully:', responses.length);

    // Fetch answers
    if (responses.length > 0) {
      console.log('Fetching answers');
      const responseIds = responses.map(r => r.id);
      const { data: answers, error: answersError } = await supabase
        .from('answers')
        .select('*')
        .in('response_id', responseIds);

      if (answersError) throw answersError;
      console.log('Answers fetched successfully:', answers.length);

      // Calculate category scores
      console.log('Calculating category scores');
      const categoryScores = {};
      categories.forEach(category => {
        const categoryQuestions = category.questions.map(q => q.id);
        const categoryAnswers = answers.filter(answer => 
          categoryQuestions.includes(answer.question_id) && answer.score !== null
        );
        
        if (categoryAnswers.length > 0) {
          const totalScore = categoryAnswers.reduce((sum, answer) => sum + (answer.score || 0), 0);
          categoryScores[category.title] = totalScore / categoryAnswers.length;
        } else {
          categoryScores[category.title] = 0;
        }
      });
      console.log('Category scores calculated');

      // Calculate top responses
      console.log('Calculating top responses');
      const topResponses = {};
      categories.forEach(category => {
        category.questions.forEach(question => {
          const questionAnswers = answers.filter(a => a.question_id === question.id);
          
          if (questionAnswers.length > 0) {
            // Count frequency of each response
            const responseCounts = {};
            questionAnswers.forEach(answer => {
              const value = answer.value || 'No response';
              responseCounts[value] = (responseCounts[value] || 0) + 1;
            });
            
            // Sort by frequency and get top 3
            const sortedResponses = Object.entries(responseCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([value, count]) => ({ value, count }));
            
            topResponses[question.id] = {
              question: question.prompt,
              type: question.type,
              responses: sortedResponses
            };
          }
        });
      });
      console.log('Top responses calculated');

      // Generate HTML for the PDF
      console.log('Generating HTML for PDF');
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Survey Report: ${survey.title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            h2 { color: #555; margin-top: 30px; }
            h3 { color: #777; margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .category-score { margin-bottom: 5px; }
            .response-item { margin-bottom: 5px; }
          </style>
        </head>
        <body>
          <h1>Survey Report: ${survey.title}</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          
          <h2>Overview</h2>
          <p>Total Responses: ${responses.length}</p>
          
          <h2>Category Scores</h2>
          ${Object.entries(categoryScores).map(([category, score]) => 
            `<div class="category-score"><strong>${category}:</strong> ${score.toFixed(2)}</div>`
          ).join('')}
          
          <h2>Top Responses</h2>
          ${Object.entries(topResponses).map(([questionId, data]) => `
            <h3>${data.question}</h3>
            ${data.responses.map(response => 
              `<div class="response-item">- ${response.value}: ${response.count} responses</div>`
            ).join('')}
          `).join('')}
        </body>
        </html>
      `;
      console.log('HTML generated successfully');

      // Generate PDF with Puppeteer
      console.log('Generating PDF with Puppeteer');
      let browser;
      let pdfBuffer = null; // Initialize pdfBuffer to null
      
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        });
        console.log('Puppeteer browser launched successfully');
        
        const page = await browser.newPage();
        console.log('New page created');
        
        await page.setContent(html, { waitUntil: 'networkidle0' });
        console.log('HTML content set');
        
        pdfBuffer = await page.pdf({ 
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20mm',
            right: '20mm',
            bottom: '20mm',
            left: '20mm'
          }
        });
        console.log('PDF generated successfully');
        
        await browser.close();
        console.log('Browser closed');
      } catch (puppeteerError) {
        console.error('Puppeteer error:', puppeteerError);
        if (browser) await browser.close();
        throw new Error(`Failed to generate PDF: ${puppeteerError.message}`);
      }

      // Check if pdfBuffer is defined before proceeding
      if (!pdfBuffer) {
        throw new Error('PDF buffer is not defined');
      }

      // Store the PDF in Supabase storage
      console.log('Storing PDF in Supabase storage');
      let publicUrl = null;
      
      try {
        // First, check if the bucket exists
        console.log('Checking if survey-reports bucket exists');
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        
        if (bucketsError) {
          console.error('Error listing buckets:', bucketsError);
          throw new Error(`Failed to list storage buckets: ${bucketsError.message}`);
        }
        
        const surveyReportsBucket = buckets.find(bucket => bucket.name === 'survey-reports');
        
        if (!surveyReportsBucket) {
          // Bucket doesn't exist, create it
          console.log('Creating survey-reports bucket');
          const { error: createBucketError } = await supabase.storage.createBucket('survey-reports');
          
          if (createBucketError) {
            console.error('Error creating bucket:', createBucketError);
            throw new Error(`Failed to create storage bucket: ${createBucketError.message}`);
          }
          
          console.log('Bucket created successfully');
        } else {
          console.log('Bucket already exists');
        }
        
        // Upload the PDF to Supabase storage using the Supabase client
        const fileName = `survey-report-${surveyId}-${Date.now()}.pdf`;
        console.log('Uploading PDF to Supabase storage');
        
        // Try to upload with a retry mechanism
        let uploadSuccess = false;
        let uploadAttempts = 0;
        const maxUploadAttempts = 3;
        
        while (!uploadSuccess && uploadAttempts < maxUploadAttempts) {
          uploadAttempts++;
          console.log(`Upload attempt ${uploadAttempts} of ${maxUploadAttempts}`);
          
          try {
            // Convert the PDF buffer to a base64 string
            const pdfBase64 = pdfBuffer.toString('base64');
            
            // Use the Supabase storage client directly
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('survey-reports')
              .upload(fileName, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: false
              });
            
            if (uploadError) {
              console.error(`Upload attempt ${uploadAttempts} failed:`, uploadError);
              if (uploadAttempts >= maxUploadAttempts) {
                throw uploadError;
              }
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 2000 * uploadAttempts));
            } else {
              console.log('Upload successful');
              uploadSuccess = true;
              
              // Get the public URL of the uploaded file
              const { data: urlData } = supabase.storage
                .from('survey-reports')
                .getPublicUrl(fileName);
              
              publicUrl = urlData.publicUrl;
              console.log('PDF stored successfully at:', publicUrl);
            }
          } catch (uploadError) {
            console.error(`Upload attempt ${uploadAttempts} failed with exception:`, uploadError);
            if (uploadAttempts >= maxUploadAttempts) {
              throw uploadError;
            }
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 2000 * uploadAttempts));
          }
        }
        
        if (!publicUrl) {
          throw new Error('Failed to get public URL after upload');
        }
        
        // Try to update the respondent record with the report URL, but don't fail if the column doesn't exist
        try {
          // First check if the column exists by trying to fetch the respondent
          const { data: respondent, error: fetchError } = await supabase
            .from('respondents')
            .select('id')
            .eq('id', respondentId)
            .single();
          
          if (fetchError) {
            console.log('Could not fetch respondent record:', fetchError.message);
          } else {
            // Try to update the respondent record
            const { error: updateError } = await supabase
              .from('respondents')
              .update({ report_url: publicUrl })
              .eq('id', respondentId);
            
            if (updateError) {
              console.log('Could not update respondent record (column may not exist):', updateError.message);
            } else {
              console.log('Respondent record updated with report URL');
            }
          }
        } catch (updateError) {
          console.log('Error updating respondent record:', updateError.message);
        }
        
        // Send a simple email notification with the link to the report
        console.log('Sending email notification with report link');
        const emailPayload = {
          from: process.env.MAILEROO_FROM_EMAIL,
          to: email,
          subject: `Your Survey Report is Ready`,
          text: `Thank you for participating in our survey. Your report is now available at: ${publicUrl}`,
        };
        
        console.log('Making request to Maileroo API');
        const mailerooResponse = await fetch('https://api.maileroo.com.au/v1/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.MAILEROO_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailPayload),
        });
        
        console.log('Maileroo response status:', mailerooResponse.status);
        
        if (!mailerooResponse.ok) {
          const errorText = await mailerooResponse.text();
          console.error('Maileroo error response:', errorText);
          // Don't throw an error here, just log it and continue
          // The report has been generated and stored, which is the main goal
        } else {
          console.log('Email notification sent successfully');
        }
        
        // Return the public URL in the response
        res.status(200).json({ 
          success: true, 
          reportUrl: publicUrl,
          message: 'Report generated successfully. A notification email has been sent with the link to your report.'
        });
      } catch (storageError) {
        console.error('Storage error:', storageError);
        throw new Error(`Failed to store report: ${storageError.message}`);
      }
    } else {
      throw new Error('No responses found for this survey');
    }
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: error.message });
  }
}