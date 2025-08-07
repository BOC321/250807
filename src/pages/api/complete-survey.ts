// API route for handling survey submissions and report generation

import { NextApiRequest, NextApiResponse } from 'next';
import { SurveyService, RespondentService, AnswerService, ResultService } from '../../src/services/supabaseService';
import { calculateQuestionScore, calculateCategoryScore, calculateOverallScore, calculateCompletionRate, determineBand } from '../../src/utils/scoring';
import { PDFService } from '../../src/services/pdfService';
import { mailerooService } from '../../src/services/mailerooService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { respondentId } = req.body;

  if (!respondentId) {
    return res.status(400).json({ error: 'Respondent ID is required' });
  }

  try {
    // Get respondent and survey data
    const respondent = await supabase
      .from('respondents')
      .select('*, surveys(*)')
      .eq('id', respondentId)
      .single();

    if (!respondent.data) {
      return res.status(404).json({ error: 'Respondent not found' });
    }

    const survey = respondent.data.surveys;

    // Get all answers
    const answers = await AnswerService.getAnswersByRespondentId(respondentId);

    // Get questions
    const questions = await SurveyService.getQuestionsBySurveyId(survey.id);

    // Get categories
    const categories = await SurveyService.getCategoriesBySurveyId(survey.id);

    // Calculate category results
    const categoryResults = categories.map(category => {
      return calculateCategoryScore(category.id, questions, answers);
    });

    // Calculate overall result
    const categoryWeights = {};
    categories.forEach(cat => {
      categoryWeights[cat.id] = cat.weight;
    });

    const overallResult = calculateOverallScore(categoryResults, categoryWeights);

    // Determine bands
    if (survey.ranges_overall_version_id) {
      const rangeSet = await SurveyService.getRangeSetById(survey.ranges_overall_version_id);
      if (rangeSet) {
        overallResult.bandId = determineBand(overallResult.percent, rangeSet) || '';
      }
    }

    // Calculate completion rate
    const totalQuestions = questions.filter(q => q.scorable).length;
    const answeredQuestions = answers.length;
    const completionRate = calculateCompletionRate(answeredQuestions, totalQuestions);

    // Prepare report data
    const reportData = {
      title: survey.title,
      respondentEmail: respondent.data.email,
      completedAt: respondent.data.created_at,
      result: {
        perCategory: categoryResults,
        overall: overallResult,
        completedCount: answeredQuestions,
        scorableCount: totalQuestions,
        createdAt: new Date().toISOString()
      },
      categories: categories.map((category, index) => ({
        id: category.id,
        title: category.title,
        description: category.description,
        result: categoryResults[index]
      })),
      overall: overallResult,
      completionRate
    };

    // Generate PDF report
    const pdfBuffer = await PDFService.generateSurveyReport(reportData);
    
    // In a real implementation, you would save this to storage or encode it for download
    
    // Send email with report link
    if (respondent.data.email) {
      // In a real implementation, you would generate a shareable link to the report
      const reportUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/report/${respondentId}`;
      
      await mailerooService.sendSurveyReport(
        respondent.data.email,
        survey.title,
        reportUrl,
        '' // respondent name if available
      );
    }

    // Save results to database
    const result = await ResultService.saveResult(
      respondentId,
      categoryResults,
      overallResult,
      answeredQuestions,
      totalQuestions
    );

    res.status(200).json({
      success: true,
      resultId: result.id,
      message: 'Survey completed successfully. Report sent via email.'
    });
  } catch (error) {
    console.error('Survey completion error:', error);
    res.status(500).json({ 
      error: 'Failed to complete survey',
      details: error.message 
    });
  }
}
