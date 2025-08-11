import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';

// Debug: Log all environment variables
console.log('Environment variables debug:');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('SUPABASE_SECRET_KEY:', process.env.SUPABASE_SECRET_KEY ? 'Set (length: ' + process.env.SUPABASE_SECRET_KEY.length + ')' : 'Not set');

// Initialize Supabase client with error handling
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or key');
  console.error('Supabase URL:', supabaseUrl ? 'Set' : 'Not set');
  console.error('Supabase Key:', supabaseKey ? 'Set' : 'Not set');
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

  const { surveyId, respondentId, email } = req.body;

  try {
    console.log('Starting report generation for survey:', surveyId);
    
    // Add debugging information
    console.log('Supabase URL:', supabaseUrl);
    console.log('Secret key length:', supabaseKey ? supabaseKey.length : 'undefined');
    
    // Check environment variables
    if (!supabaseKey) {
      throw new Error('SUPABASE_SECRET_KEY is not set');
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

    // Calculate category scores using the correct formula
    const getCategoryScores = () => {
      const categoryScores = {};
      const categoryMaxScores = {};
      
      survey.categories.forEach(category => {
        const categoryQuestions = category.questions.map(q => q.id);
        const categoryAnswers = answers.filter(answer => 
          categoryQuestions.includes(answer.question_id) && answer.score !== null
        );
        
        // Calculate actual score for the category
        let categoryScore = 0;
        let categoryMaxScore = 0;
        
        if (categoryAnswers.length > 0) {
          // Sum the actual scores
          categoryScore = categoryAnswers.reduce((sum, answer) => sum + (answer.score || 0), 0);
          
          // Calculate maximum possible score for this category
          category.questions.forEach(question => {
            categoryMaxScore += question.max_score || 1; // Use max_score from question, default to 1 if not set
          });
        }
        
        // Calculate percentage using the correct formula
        const categoryPercentage = categoryMaxScore > 0 ? (categoryScore / categoryMaxScore) * 100 : 0;
        
        categoryScores[category.title] = {
          score: categoryScore,
          maxScore: categoryMaxScore,
          percentage: categoryPercentage
        };
        
        categoryMaxScores[category.title] = categoryMaxScore;
      });
      
      return { categoryScores, categoryMaxScores };
    };

    // Helper function to get score range (same as results page)
    const getScoreRange = (percentage, ranges) => {
      return ranges.find(range => percentage >= range.min_score && percentage <= range.max_score);
    };

    const { categoryScores, categoryMaxScores } = getCategoryScores();

    // Calculate total score using the correct formula
    let totalScore = 0;
    let totalMaxScore = 0;
    
    Object.values(categoryScores).forEach(categoryData => {
      totalScore += categoryData.score;
      totalMaxScore += categoryData.maxScore;
    });
    
    const totalPercentage = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;

    console.log('Fetched answers:', answers);
    console.log('Fetched score ranges:', scoreRanges);
    console.log('Calculated category scores:', categoryScores);
    console.log('Category max scores:', categoryMaxScores);
    console.log('Total score:', totalScore, 'Total max score:', totalMaxScore, 'Total percentage:', totalPercentage);

    // Create a map of question_id to answer for easy lookup
    const answerMap = {};
    answers.forEach(answer => {
      answerMap[answer.question_id] = answer.value;
    });

    // Generate PDF report in memory
    const pdfDoc = new PDFDocument();
    const fileName = `report-${uuidv4()}.pdf`;
    
    // Collect PDF chunks
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    
    // Build PDF content
    pdfDoc.fontSize(25).text('Survey Report', { underline: true });
    pdfDoc.moveDown();
    pdfDoc.fontSize(18).text(`Survey Title: ${survey.title}`);
    pdfDoc.text(`Respondent Name: ${respondent.name || 'Anonymous'}`);
    pdfDoc.text(`Generated on: ${new Date().toLocaleDateString()}`);
    pdfDoc.moveDown();

    // Add Total Score
    if (Object.keys(categoryScores).length > 0) {
      pdfDoc.fontSize(20).text('Total Score', { underline: true });
      pdfDoc.moveDown();
      
      const totalRange = getScoreRange(totalPercentage, scoreRanges.total);
      
      pdfDoc.fontSize(16).text(`Score: ${Math.round(totalPercentage)}%`);
      
      if (totalRange) {
        pdfDoc.fontSize(14);
        if (totalRange.color) {
          pdfDoc.fillColor(totalRange.color).text(`Interpretation: ${totalRange.description}`);
          pdfDoc.fillColor('black');
        } else {
          pdfDoc.text(`Interpretation: ${totalRange.description}`);
        }
      }
      pdfDoc.moveDown();
    }

    // Add Category Scores
    pdfDoc.fontSize(20).text('Category Scores', { underline: true });
    pdfDoc.moveDown();
    
    Object.entries(categoryScores).forEach(([category, categoryData]) => {
      const categoryId = survey.categories.find(c => c.title === category)?.id;
      const ranges = scoreRanges.categories[categoryId] || [];
      const range = getScoreRange(categoryData.percentage, ranges);
      
      pdfDoc.fontSize(16).text(`${category}: ${Math.round(categoryData.percentage)}%`);
      
      if (range) {
        pdfDoc.fontSize(14);
        if (range.color) {
          pdfDoc.fillColor(range.color).text(`Interpretation: ${range.description}`);
          pdfDoc.fillColor('black');
        } else {
          pdfDoc.text(`Interpretation: ${range.description}`);
        }
      }
      pdfDoc.moveDown();
    });

    // Add Detailed Responses
    pdfDoc.fontSize(20).text('Detailed Responses', { underline: true });
    pdfDoc.moveDown();
    
    if (survey.categories) {
      survey.categories.forEach((category) => {
        pdfDoc.fontSize(16).text(`Category: ${category.title}`, { underline: true });
        pdfDoc.moveDown();
        
        if (category.questions) {
          category.questions.forEach((question) => {
            pdfDoc.fontSize(14).text(`Question: ${question.prompt || question.text}`);
            
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
            
            pdfDoc.fontSize(12).text(`Answer: ${answerText}`);
            pdfDoc.moveDown();
          });
        }
      });
    }

    pdfDoc.end();

    // Wait for PDF to be generated
    await new Promise((resolve) => {
      pdfDoc.on('end', resolve);
    });

    // Combine chunks into a single buffer
    const pdfBuffer = Buffer.concat(chunks);

    // Upload PDF to Supabase storage
    console.log('Uploading PDF to Supabase storage...');
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
