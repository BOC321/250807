import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';

// Debug: Log all environment variables
console.log('Environment variables debug:');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set (length: ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : 'Not set');

// Initialize Supabase client with error handling
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or key');
  console.error('Supabase URL:', supabaseUrl ? 'Set' : 'Not set');
  console.error('Supabase Key:', supabaseKey ? 'Set' : 'Not set');
  throw new Error('Missing Supabase URL or key');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { surveyId, respondentId, email } = req.body;

  try {
    console.log('Starting report generation for survey:', surveyId);
    
    // Add debugging information
    console.log('Supabase URL:', supabaseUrl);
    console.log('Secret key length:', supabaseKey ? supabaseKey.length : 'undefined');
    
    // Check environment variables
    if (!supabaseKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
    }
    if (!process.env.GMAIL_EMAIL) {
      throw new Error('GMAIL_EMAIL is not set');
    }
    if (!process.env.GMAIL_APP_PASSWORD) {
      throw new Error('GMAIL_APP_PASSWORD is not set');
    }
    
    console.log('Environment variables are set');
    
    // Test the Supabase connection
    try {
      console.log('Testing Supabase connection...');
      const { data, error } = await supabase.from('surveys').select('count').single();
      if (error) {
        console.error('Supabase connection test failed:', error);
        throw new Error(`Supabase connection test failed: ${error.message}`);
      }
      console.log('Supabase connection test successful');
    } catch (error) {
      console.error('Supabase connection test exception:', error);
      throw error;
    }
    
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
    console.log('Fetching responses for respondent:', respondentId);
    const { data: responses, error: responsesError } = await supabase
      .from('responses')
      .select('*')
      .eq('survey_id', surveyId)
      .eq('respondent_id', respondentId);

    if (responsesError) throw responsesError;
    console.log('Responses fetched successfully:', responses.length);

    if (responses.length === 0) {
      throw new Error('No responses found for this respondent');
    }

    // Fetch answers for these responses
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
        // Normalize to a 0-1 scale (assuming max score is 5)
        categoryScores[category.title] = totalScore / (categoryAnswers.length * 5);
      } else {
        categoryScores[category.title] = 0;
      }
    });
    console.log('Category scores calculated');

    // Calculate user's responses
    console.log('Calculating user responses');
    const userResponses = {};
    categories.forEach(category => {
      category.questions.forEach(question => {
        const questionAnswer = answers.find(a => a.question_id === question.id);
        
        if (questionAnswer) {
          userResponses[question.id] = {
            question: question.prompt,
            type: question.type,
            response: questionAnswer.value || 'No response'
          };
        } else {
          // Include questions that weren't answered
          userResponses[question.id] = {
            question: question.prompt,
            type: question.type,
            response: 'No response'
          };
        }
      });
    });
    console.log('User responses calculated');

    // Fetch score ranges
    console.log('Fetching score ranges');
    const scoreRanges = await fetchScoreRanges(surveyId);
    console.log('Score ranges fetched');

    // Add a function to get the score range for a given score
    const getScoreRange = (score, ranges) => {
      const percentage = Math.round(score * 100);
      return ranges.find(range => percentage >= range.min_score && percentage <= range.max_score);
    };

    // Generate HTML for PDF
    console.log('Generating HTML for PDF');
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Your Survey Report: ${survey.title}</title>
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
          .total-score { font-weight: bold; margin-top: 15px; font-size: 1.2em; }
          .score-range { margin-top: 10px; padding: 10px; border-radius: 4px; }
          .debug-info { font-size: 10px; color: #999; margin-top: 5px; }
        </style>
      </head>
      <body>
        <h1>Your Survey Report: ${survey.title}</h1>
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
        <p class="debug-info">Respondent ID: ${respondentId}</p>
        
        <h2>Category Scores</h2>
        ${Object.entries(categoryScores).map(([category, score]) => {
          const categoryId = categories.find(c => c.title === category)?.id;
          const ranges = scoreRanges.categories[categoryId] || [];
          const range = getScoreRange(score, ranges);
          const percentage = Math.round(score * 100);
          
          return `
            <div>
              <div class="category-score"><strong>${category}:</strong> ${percentage}%</div>
              ${range ? `
                <div class="score-range" style="background-color: ${range.color}20; border-left: 4px solid ${range.color};">
                  <strong>${category}:</strong> ${range.description}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
        
        ${Object.keys(categoryScores).length > 0 ? `
          <div class="total-score">
            <strong>Total Score: ${Math.round((Object.values(categoryScores).reduce((sum, score) => sum + score, 0) / Object.keys(categoryScores).length) * 100)}%</strong>
            ${(() => {
              const totalScore = Object.values(categoryScores).reduce((sum, score) => sum + score, 0) / Object.keys(categoryScores).length;
              const totalRange = getScoreRange(totalScore, scoreRanges.total);
              
              return totalRange ? `
                <div class="score-range" style="background-color: ${totalRange.color}20; border-left: 4px solid ${totalRange.color};">
                  <strong>Total Score:</strong> ${totalRange.description}
                </div>
              ` : '';
            })()}
          </div>
        ` : ''}
        
        <h2>Your Responses</h2>
        ${Object.entries(userResponses).map(([questionId, data]) => `
          <h3>${data.question}</h3>
          <div class="response-item">- ${data.response}</div>
        `).join('')}
      </body>
      </html>
    `;
    console.log('HTML generated successfully');

    // Generate PDF report using Puppeteer
    console.log('Generating PDF report using Puppeteer...');

    // Create a unique filename using both survey ID, respondent ID, and a UUID to ensure uniqueness
    const { v4: uuidv4 } = require('uuid');
    const uniqueId = uuidv4();
    const fileName = `survey-report-${surveyId}-${respondentId}-${uniqueId}-${Date.now()}.pdf`;
    console.log('Will upload PDF to Supabase storage with fileName:', fileName);

    try {
      // Launch a headless browser
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      // Create a new page
      const page = await browser.newPage();
      
      // Set the HTML content
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Generate the PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        }
      });
      
      // Close the browser
      await browser.close();
      
      console.log('PDF generated successfully, size:', pdfBuffer.length, 'bytes');
      
      // Upload the new PDF
      const { data: pdfData, error: pdfError } = await supabase.storage
        .from('survey-reports')
        .upload(fileName, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: false,
          cacheControl: '0' // No caching
        });
      
      if (pdfError) {
        console.error('PDF upload failed:', pdfError);
        return res.status(500).json({ error: `PDF upload failed: ${pdfError.message}` });
      }

      console.log('PDF upload successful:', pdfData);

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('survey-reports')
        .getPublicUrl(fileName, {
          download: false
        });
      
      // Generate a direct link to our serve-report API
      const serveUrl = `${req.headers.origin}/api/serve-report?fileName=${encodeURIComponent(fileName)}`;
      console.log('Serve URL:', serveUrl);

      // Update the respondent record with the report URL
      try {
        console.log('Updating respondent record with report URL');
        
        const { error: updateError } = await supabase
          .from('respondents')
          .update({ 
            report_url: serveUrl,
            report_generated_at: new Date().toISOString()
          })
          .eq('id', respondentId);
        
        if (updateError) {
          console.error('Error updating respondent record:', updateError);
        } else {
          console.log('Respondent record updated successfully');
        }
      } catch (err) {
        console.error('Exception updating respondent record:', err);
      }

      // Send a simple email notification with the link to the report
      console.log('Sending email notification with report link');
      let emailSent = false;
      let emailError = '';

      try {
        // Create a transporter using Gmail
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_EMAIL, // Your Gmail address
            pass: process.env.GMAIL_APP_PASSWORD, // Your Gmail app password
          },
        });

        // Define the email options with HTML formatting
        const mailOptions = {
          from: process.env.GMAIL_EMAIL,
          to: email,
          subject: `Your Survey Report is Ready`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333;">Your Survey Report is Ready</h2>
              <p>Thank you for participating in our survey. Your personalized report is now available.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${serveUrl}" target="_blank" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Your Report</a>
              </div>
              <p>If the button above doesn't work, you can copy and paste the following link into your browser:</p>
              <p style="word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 4px;">${serveUrl}</p>
              <p style="margin-top: 30px; font-size: 14px; color: #666;">This link will expire in 30 days.</p>
              <p style="font-size: 14px; color: #666;">Thank you,<br>The Survey Team</p>
            </div>
          `,
        };

        // Send the email
        const info = await transporter.sendMail(mailOptions);
        console.log('Email notification sent successfully via Gmail:', info.messageId);
        emailSent = true;
      } catch (gmailError) {
        console.error('Error sending email notification via Gmail:', gmailError);
        emailError = `Gmail error: ${gmailError.message}`;
      }

      // Return the serve URL in the response
      res.status(200).json({ 
        success: true, 
        reportUrl: serveUrl,
        emailSent: emailSent,
        message: emailSent 
          ? 'Report generated successfully. A notification email has been sent with the link to your report.'
          : `Report generated successfully. However, we were unable to send a notification email (${emailError}). Please use the following link to access your report: ${serveUrl}`
      });
    } catch (error) {
      console.error('Error in PDF generation or upload:', error);
      res.status(500).json({ error: error.message });
    }
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: error.message });
  }
}

// Add the fetchScoreRanges function to the generate-report.js file
const fetchScoreRanges = async (surveyId) => {
  try {
    // Fetch category score ranges
    const { data: categoryRanges, error: categoryError } = await supabase
      .from('score_ranges')
      .select('*')
      .eq('survey_id', surveyId)
      .not('category_id', 'is', null);
    
    if (categoryError) throw categoryError;
    
    // Fetch total score ranges
    const { data: totalRanges, error: totalError } = await supabase
      .from('score_ranges')
      .select('*')
      .eq('survey_id', surveyId)
      .is('category_id', null);
    
    if (totalError) throw totalError;
    
    // Organize ranges by category ID
    const rangesByCategory = {};
    categoryRanges.forEach(range => {
      if (!rangesByCategory[range.category_id]) {
        rangesByCategory[range.category_id] = [];
      }
      rangesByCategory[range.category_id].push(range);
    });
    
    return {
      categories: rangesByCategory,
      total: totalRanges || []
    };
  } catch (err) {
    console.error('Error fetching score ranges:', err);
    return {
      categories: {},
      total: []
    };
  }
};