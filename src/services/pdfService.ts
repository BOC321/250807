// PDF generation service

import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import htmlToPdfmake from 'html-to-pdfmake';
import { Result, CategoryResult, OverallResult } from '../types';

// Add virtual file system for fonts
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

interface ReportData {
  title: string;
  respondentEmail?: string;
  completedAt: string;
  result: Result;
  categories: Array<{
    id: string;
    title: string;
    description?: string;
    result: CategoryResult;
  }>;
  overall: OverallResult;
  completionRate: number;
}

export class PDFService {
  /**
   * Generate a survey report PDF
   */
  static async generateSurveyReport(reportData: ReportData): Promise<Uint8Array> {
    // Convert HTML content to PDFMake format
    const docDefinition: any = {
      content: [
        {
          text: reportData.title,
          style: 'header'
        },
        {
          text: `Completed on: ${new Date(reportData.completedAt).toLocaleDateString()}`,
          style: 'subheader'
        },
        reportData.respondentEmail ? {
          text: `Respondent: ${reportData.respondentEmail}`,
          style: 'subheader'
        } : null,
        {
          text: `Completion Rate: ${reportData.completionRate}%`,
          style: 'subheader'
        },
        {
          text: 'Overall Score',
          style: 'sectionHeader'
        },
        {
          text: `${reportData.overall.percent}% (${reportData.overall.score}/${reportData.overall.max})`,
          style: 'score'
        },
        {
          text: 'Category Scores',
          style: 'sectionHeader',
          margin: [0, 20, 0, 10]
        },
        ...reportData.categories.map(category => ([
          {
            text: category.title,
            style: 'categoryHeader'
          },
          {
            text: `${category.result.percent}% (${category.result.score}/${category.result.max})`,
            style: 'categoryScore'
          }
        ])).flat(),
        {
          text: 'Detailed Results',
          style: 'sectionHeader',
          margin: [0, 20, 0, 10]
        }
        // Add more detailed content here as needed
      ],
      styles: {
        header: {
          fontSize: 22,
          bold: true,
          margin: [0, 0, 0, 10]
        },
        subheader: {
          fontSize: 14,
          italics: true,
          margin: [0, 10, 0, 5]
        },
        sectionHeader: {
          fontSize: 18,
          bold: true,
          margin: [0, 15, 0, 10]
        },
        score: {
          fontSize: 16,
          bold: true,
          color: '#007bff',
          margin: [0, 0, 0, 15]
        },
        categoryHeader: {
          fontSize: 14,
          bold: true,
          margin: [0, 10, 0, 5]
        },
        categoryScore: {
          fontSize: 12,
          margin: [0, 0, 0, 10]
        }
      }
    };

    // Create the PDF
    const pdfDoc = pdfMake.createPdf(docDefinition);
    
    // Return as Uint8Array
    return new Promise<Uint8Array>((resolve, reject) => {
      (pdfDoc as any).getBuffer((buffer: Uint8Array) => {
        resolve(buffer);
      });
    });
  }

  /**
   * Generate and return PDF as base64 string
   */
  static async generateSurveyReportBase64(reportData: ReportData): Promise<string> {
    const buffer = await this.generateSurveyReport(reportData);
    return Buffer.from(buffer).toString('base64');
  }
}
