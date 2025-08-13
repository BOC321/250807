const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const nodemailer = require('nodemailer');
const { computeScores, pickRange } = require('@/lib/scoring');

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

// Helper to check if column exists
async function columnExists(tableName, columnName) {
  const { data, error } = await supabase
    .rpc('column_exists', { 
      table_name: tableName,
      column_name: columnName 
    });
  
  if (error) {
    console.error(`Column check error for ${tableName}.${columnName}:`, error);
    return false;
  }
  return data;
}

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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { surveyId, respondentId, email } = req.body;

  try {
    console.log('🚀 Starting report generation for survey:', surveyId);
    console.log('📧 Email:', email);
    
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
      .select('*')
      .eq('id', surveyId)
      .single();

    if (surveyError) throw surveyError;

    const { data: respondent, error: respondentError } = await supabase
      .from('respondents')
      .select('*')
      .eq('id', respondentId)
      .single();

    if (respondentError) throw respondentError;

    // Fetch user's answers
    const { data: answers, error: answersError } = await supabase
      .from('answers')
      .select('*')
      .eq('respondent_id', respondentId);

    if (answersError) throw answersError;

    // Fetch categories with questions and options
    console.log('Fetching categories with questions and options');
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select(`
        id, 
        title, 
        weight,
        questions (
          id, 
          prompt, 
          weight,
          scorable,
          meta,
          question_options ( score, label )
        )
      `)
      .eq('survey_id', surveyId)
      .order('order', { ascending: true });

    if (categoriesError) throw categoriesError;
    console.log('Categories fetched successfully');

    // Fetch score ranges (0-100 scale)
    console.log('Fetching score ranges');
    const fetchScoreRanges = async (surveyId) => {
      try {
        const { data: categoryRanges, error: categoryError } = await supabase
          .from('score_ranges')
          .select('*')
          .eq('survey_id', surveyId)
          .not('category_id', 'is', null);
        
        if (categoryError) throw categoryError;
        
        const { data: totalRanges, error: totalError } = await supabase
          .from('score_ranges')
          .select('*')
          .eq('survey_id', surveyId)
          .is('category_id', null);
        
        if (totalError) throw totalError;
        
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
        return { categories: {}, total: [] };
      }
    };

    const scoreRanges = await fetchScoreRanges(surveyId);
    console.log('Score ranges fetched');

    // Calculate normalized scores
    console.log('Calculating normalized scores');
    const answerObjects = answers.map(a => ({
      question_id: a.question_id,
      score: a.score
    }));
    
    const { categoryPercents, totalPercent } = computeScores(
      categories,
      answerObjects,
      { 
        treatMissingAsZero: true,
        useQuestionWeights: true,
        useCategoryWeights: false 
      }
    );
    console.log('Scores calculated:', { categoryPercents, totalPercent });

    // Create answer map for responses
    const answerMap = {};
    answers.forEach(answer => {
      answerMap[answer.question_id] = answer.value;
    });

    // Generate PDF report
    console.log('Launching browser with Chromium...');
    const executablePath = await chromium.executablePath();
    console.log('Using executable path:', executablePath);
    
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: executablePath,
      headless: 'new',
      ignoreHTTPSErrors: true,
    });
    
    console.log('Browser launched successfully');
    const page = await browser.newPage();
    
    // Generate HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
          h1, h2, h3 { color: #333; }
          .score-range { margin-top: 0.5rem; padding: 0.75rem; border-left: 4px solid; background-color: #f8f9fa; }
          .response-item { margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #ddd; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Survey Report</h1>
        <h2>${survey.title}</h2>
        <p><strong>Respondent Name:</strong> ${respondent.name || 'Anonymous'}</p>
        <p><strong>Generated on:</strong> ${new Date().toLocaleDateString()}</p>
        
        <h2>Total Score</h2>
        <p>Score: ${totalPercent.toFixed(2)}%</p>
        
        ${Object.keys(categoryPercents).length > 0 ? `
          <h2>Category Scores</h2>
          ${Object.entries(categoryPercents).map(([category, percentage]) => {
            const categoryId = categories.find(c => c.title === category)?.id;
            const ranges = scoreRanges.categories[categoryId] || [];
            const range = pickRange(percentage, ranges);
            
            return `
              <div>
                <p><strong>${category}:</strong> ${percentage.toFixed(2)}%</p>
                ${range ? `<div class="score-range" style="border-color: ${range.color};">${range.description}</div>` : ''}
              </div>
            `;
          }).join('')}
        ` : ''}
        
        <h2>Detailed Responses</h2>
        ${categories.map(category => `
          <div class="response-item">
            <h3>${category.title}</h3>
            ${category.questions.map(question => {
              const userAnswer = answerMap[question.id];
              let answerText = 'Not answered';
              
              if (userAnswer) {
                if (typeof userAnswer === 'string') {
                  answerText = userAnswer;
                } else if (typeof userAnswer === 'object') {
                  answerText = JSON.stringify(userAnswer);
                } else {
                  answerText = String(userAnswer);
                }
              }
              
              return `
                <div>
                  <p><strong>Question:</strong> ${question.prompt}</p>
                  <p><strong>Answer:</strong> ${answerText}</p>
                </div>
              `;
            }).join('')}
          </div>
        `).join('')}
      </body>
      </html>
    `;

    await page.setContent(htmlContent);
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    // Upload PDF to storage
    const fileName = `report-${uuidv4()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('survey-reports')
      .upload(fileName, pdfBuffer, { contentType: 'application/pdf' });

    if (uploadError) throw uploadError;

    // Generate serve URL
    const serveUrl = `${req.headers.origin}/api/reports/serve?fileName=${encodeURIComponent(fileName)}`;

    // Update respondent record
    const { error: updateError } = await supabase
      .from('respondents')
      .update({ report_url: serveUrl })
      .eq('id', respondentId);

    if (updateError) console.error('Error updating respondent:', updateError);

    // Send email notification
    await emailService.sendEmail({
      to: email,
      subject: 'Your Survey Report',
      html: `
        <p>Hello,</p>
        <p>Your report for <strong>${survey.title}</strong> is ready:</p>
        <p><a href="${serveUrl}">View Report</a></p>
        <p>Thank you for participating!</p>
      `
    });

    return res.status(200).json({ 
      message: 'Report generated successfully', 
      serveUrl,
      fileName
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return res.status(500).json({ error: error.message });
  }
};
