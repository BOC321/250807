import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import nodemailer from 'nodemailer';

// Debug: Log all environment variables
console.log('Environment variables debug:');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Present' : 'Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Present (length: ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : 'Missing');
console.log('GMAIL_EMAIL:', process.env.GMAIL_EMAIL ? 'Present' : 'Missing');
console.log('GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? 'Present' : 'Missing');

// Debug Chromium setup
console.log('Chromium debug:');
console.log('Platform:', process.platform);
console.log('Chromium available:', chromium ? 'Yes' : 'No');
console.log('Chromium headless:', chromium.headless);
console.log('Chromium args length:', chromium.args ? chromium.args.length : 'None');

// Get executable path for debugging
chromium.executablePath().then(path => {
  console.log('Chromium executable path:', path);
}).catch(err => {
  console.error('Error getting Chromium executable path:', err);
});

// Initialize Supabase client with error handling
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or key');
  throw new Error('Missing Supabase URL or key');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Real email service using Gmail SMTP
class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  async sendEmail(options) {
    try {
      console.log('Sending email to:', options.to);
      console.log('Subject:', options.subject);
      
      const mailOptions = {
        from: process.env.GMAIL_EMAIL || process.env.DEFAULT_EMAIL_SENDER,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }
}

const emailService = new EmailService();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

    const { surveyId, respondentId, email, categoryPercentages, totalPercentage, userResponses } = req.body;

  try {
    console.log('🚀 Starting report generation for survey:', surveyId);
    console.log('📧 Email:', email);
    console.log('📊 Received category scores type:', typeof categoryScores);
    console.log('📊 Received category scores value:', categoryScores);
    console.log('📊 Received category scores keys:', categoryScores ? Object.keys(categoryScores) : 'undefined');
    console.log('📊 Received user responses type:', typeof userResponses);
    console.log('📊 Received user responses:', userResponses);
    
    // Add debugging information
    console.log('Supabase URL:', supabaseUrl);
    console.log('Secret key length:', supabaseKey ? supabaseKey.length : 'undefined');
    
    // Check environment variables
    if (!supabaseKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
    }
    
    console.log('Environment variables are set');

    // Fetch survey and respondent data
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('*, categories(*, questions(*))')
      .eq('id', surveyId)
      .single();

    if (surveyError) {
      throw surveyError;
    }

    const { data: respondent, error: respondentError } = await supabase
      .from('respondents')
      .select('*')
      .eq('id', respondentId)
      .single();

    if (respondentError) {
      throw respondentError;
    }

    // Fetch user's answers for this respondent
    const { data: answers, error: answersError } = await supabase
      .from('answers')
      .select('*')
      .eq('respondent_id', respondentId);

    if (answersError) {
      throw answersError;
    }

    // Fetch score ranges using the same logic as the results page
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

    const scoreRanges = await fetchScoreRanges(surveyId);

    // Always calculate scores directly from database answers
    console.log('📊 Calculating scores directly from database answers');
    
    const getCategoryScores = () => {
      const categoryScores = {};
      let totalScore = 0;
      let totalMaxScore = 0;
      
      survey.categories.forEach(category => {
        const categoryQuestions = category.questions.map(q => q.id);
        const categoryAnswers = answers.filter(answer => 
          categoryQuestions.includes(answer.question_id) && answer.score !== null
        );
        
        // Calculate actual score for the category
        let categoryScore = 0;
        let categoryMaxScore = 0;
        
        category.questions.forEach(question => {
          const answer = answers.find(a => a.question_id === question.id);
          const maxScore = Number(question.max_score) || 1;
          const answerScore = Number(answer?.score) || 0;
          
          console.log(`📊 ${question.prompt}: ${answerScore}/${maxScore}`);
          
          categoryScore += answerScore;
          categoryMaxScore += maxScore;
        });
        
        // Calculate percentage using the correct formula
        const categoryPercentage = categoryMaxScore > 0 ? (categoryScore / categoryMaxScore) * 100 : 0;
        categoryScores[category.title] = categoryPercentage;
        
        // Accumulate totals
        totalScore += categoryScore;
        totalMaxScore += categoryMaxScore;
      });
      
    // Calculate overall percentage with proper decimal handling
    const totalPercentage = totalMaxScore > 0 ? 
      Number(((totalScore / totalMaxScore) * 100).toFixed(2)) : 0;
      
      return {
        categoryScores,
        totalPercentage
      };
    };

    const { categoryScores: finalCategoryPercentages, totalPercentage: finalTotalPercentage } = getCategoryScores();
    
    // Debug: Log detailed score calculation
    console.log('📊 Detailed Score Breakdown:');
    survey.categories.forEach(category => {
      console.log(`\nCategory: ${category.title}`);
      category.questions.forEach(question => {
        const answer = answers.find(a => a.question_id === question.id);
        const maxScore = question.max_score || 1;
        console.log(`- Question: ${question.prompt || question.text}`);
        console.log(`  Answer ID: ${answer?.id || 'none'}`);
        console.log(`  Answer Score: ${answer?.score || 0}/${maxScore}`);
      });
    });
    console.log('📊 Final Calculation Summary:');
    console.log(`Total Raw Score: ${totalScore}`);
    console.log(`Total Max Score: ${totalMaxScore}`);
    console.log(`Calculated Percentage: ${finalTotalPercentage}%`);

    // Helper function to get score range (same as results page)
    const getScoreRange = (percentage, ranges) => {
      return ranges.find(range => percentage >= range.min_score && percentage <= range.max_score);
    };

    // Deep verification of answer scores
    console.log('🔍 Answer Score Verification:');
    answers.forEach(answer => {
      console.log(`- Question ${answer.question_id}: ${answer.score || 0} points`);
    });
    
    // Verify survey question max scores
    console.log('🔍 Survey Max Scores Verification:');
    survey.categories.forEach(category => {
      category.questions.forEach(question => {
        console.log(`- ${question.prompt}: max ${question.max_score}`);
      });
    });
    
    // Recalculate total from first principles
    const manualTotal = answers.reduce((sum, a) => sum + (a.score || 0), 0);
    const manualMax = survey.categories.reduce((sum, c) => 
      sum + c.questions.reduce((catSum, q) => catSum + (q.max_score || 1), 0), 0);
    console.log(`🔍 Manual Recalculation: ${manualTotal}/${manualMax} = ${(manualTotal/manualMax*100).toFixed(2)}%`);
    console.log('Fetched score ranges:', scoreRanges);
    console.log('Final category percentages:', finalCategoryPercentages);
    console.log('Final total percentage:', finalTotalPercentage);

    // Create a map of question_id to answer for easy lookup
    const answerMap = {};
    answers.forEach(answer => {
      answerMap[answer.question_id] = answer.value;
    });

    // Generate PDF report in memory
    console.log('Launching browser with Chromium...');
    
    // Force Puppeteer to use Chromium package
    const executablePath = await chromium.executablePath();
    console.log('Using executable path:', executablePath);
    
    const browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-javascript-harmony-promises',
        '--disable-wake-on-wifi',
        '--disable-features=site-per-process',
        '--disable-ipc-flooding-protection',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-client-side-phishing-detection',
        '--disable-crash-reporter',
        '--disable-extensions-except=test',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--enable-unsafe-swiftshader',
        '--single-process'
      ],
      executablePath: executablePath,
      headless: 'new',
      ignoreHTTPSErrors: true,
    });
    
    console.log('Browser launched successfully');
    
    const page = await browser.newPage();
    
    console.log('📊 Final values being used in PDF:');
    console.log('📊 finalTotalPercentage:', finalTotalPercentage);
    console.log('📊 finalCategoryPercentages:', finalCategoryPercentages);
    
    // Set up page content using the exact same logic as SurveyResults
    await page.setContent(`
      <h1 style="text-align: center;">Survey Report</h1>
      <h2 style="text-align: center;">${survey.title}</h2>
      <p><strong>Respondent Name:</strong> ${respondent.name || 'Anonymous'}</p>
      <p><strong>Generated on:</strong> ${new Date().toLocaleDateString()}</p>
      <h2>Total Score</h2>
      <p>Score: ${Math.round(finalTotalPercentage)}%</p>
      ${Object.keys(finalCategoryPercentages).length > 0 ? `
        <h2>Category Scores</h2>
        ${Object.entries(finalCategoryPercentages).map(([category, percentage]) => {
          const categoryId = survey.categories.find(c => c.title === category)?.id;
          const ranges = scoreRanges.categories[categoryId] || [];
          const range = getScoreRange(percentage, ranges);
          
          console.log(`📊 PDF Category ${category}: percentage=${Math.round(percentage)}%`);
          
          return `
            <p><strong>${category}:</strong> ${Math.round(percentage)}%</p>
            ${range ? `<p>Interpretation: ${range.description}</p>` : ''}
          `;
        }).join('')}
      ` : ''}
      <h2>Detailed Responses</h2>
      ${survey.categories ? survey.categories.map((category) => {
        return `
          <h3>${category.title}</h3>
          ${category.questions ? category.questions.map((question) => {
            // Get the user's answer for this question
            const userAnswer = answerMap[question.id];
            let answerText = 'Not answered';
            
            if (userAnswer) {
              if (typeof userAnswer === 'string') {
                answerText = userAnswer;
              } else if (typeof userAnswer === 'object') {
                // Handle different types of answer objects
                if (userAnswer.answer) {
                  answerText = userAnswer.answer;
                } else if (userAnswer.value) {
                  answerText = userAnswer.value;
                } else if (Array.isArray(userAnswer)) {
                  answerText = userAnswer.join(', ');
                } else {
                  answerText = JSON.stringify(userAnswer);
                }
              } else {
                answerText = String(userAnswer);
              }
            }
            
            return `
              <div style="margin-bottom: 20px;">
                <strong>Question:</strong> ${question.prompt || question.text}<br>
                <strong>Answer:</strong> ${answerText}
              </div>
            `;
          }).join('') : ''}
        `;
      }).join('') : ''}
    `);

    // Generate PDF from page
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true 
    });

    await browser.close();

    // Upload PDF to Supabase storage
    console.log('Uploading PDF to Supabase storage...');
    const fileName = `report-${uuidv4()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('survey-reports')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError);
      throw uploadError;
    }

    console.log('PDF uploaded successfully:', uploadData);

    // Generate a direct link to our serve-report API
    const serveUrl = `${req.headers.origin}/api/reports/serve?fileName=${encodeURIComponent(fileName)}`;
    console.log('Serve URL:', serveUrl);

    // Send email with report link using real email service
    await emailService.sendEmail({
      to: email,
      subject: 'Your Survey Report',
      text: `Hello, here is the link to your survey report: ${serveUrl}`,
      html: `
        <p>Hello,</p>
        <p>Thank you for completing the survey: <strong>${survey.title}</strong></p>
        <p>Your detailed report is ready. You can access it using the link below:</p>
        <p><a href="${serveUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Your Report</a></p>
        <p>Alternatively, you can copy and paste this URL into your browser:</p>
        <p>${serveUrl}</p>
        <p>Thank you for your participation!</p>
      `,
    });

    return res.status(200).json({ 
      message: 'Report generated and email sent successfully', 
      serveUrl,
      fileName
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return res.status(500).json({ error: 'Error generating report', details: error.message });
  }
}
