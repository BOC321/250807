# 🍩 Donut Chart Setup Guide for PDF Reports

## Overview
The donut chart has been successfully implemented in your survey application. Here's how to set it up and use it:

## 📍 Where to Find the Donut Chart

### 1. **Results Page** ✅ WORKING
- **Location**: `/surveys/results/[surveyId]`
- **Status**: Automatically shows - no setup needed
- **What you see**: Interactive donut chart with "Total" at the top

### 2. **Analytics Dashboard** ✅ WORKING  
- **Location**: `/admin/surveys/analytics/[surveyId]`
- **Status**: Automatically shows - no setup needed
- **What you see**: Replaces the first bar graph with donut chart

### 3. **PDF Reports** ⚙️ NEEDS SETUP
- **Location**: Generated PDF files
- **Status**: Requires configuration in PDF Report Designer
- **What you see**: CSS-based chart with horizontal bars + total circle

## 🔧 How to Set Up Donut Chart in PDFs

### Step 1: Go to PDF Report Designer
1. Open your browser to the preview application
2. Navigate to: `/admin/reports/designer`
3. Or go to Admin Dashboard → "Reports" section → "Designer"

### Step 2: Update Your Template (IMPORTANT!)
1. Look for the **blue "Update Template" button** at the top right
2. Click **"Update Template"** - this adds the new donut chart section to your existing template
3. You should see a success message: "Template updated with latest sections"

### Step 3: Enable/Configure the Donut Chart
1. Scroll down to the **"Sections & order"** section
2. Look for a checkbox labeled: **"Score Overview (visual chart)"**
3. Make sure this checkbox is **✅ CHECKED**
4. You can reorder it by using the ↑↓ buttons if needed

### Step 4: Save Your Template
1. Click the **"Save"** button at the top right
2. You should see: "Saved to report-template:global" (or survey-specific)

### Step 5: Test PDF Generation
1. Go to any survey results page
2. Enter your email and click "Request Report"
3. Check your email for the PDF - it should now include the donut chart

## 🎯 What the PDF Donut Chart Looks Like

Instead of a round donut (which doesn't work well in PDFs), you'll see:
- **Horizontal progress bars** for each category (colored by score ranges)
- **Circular "Total" badge** showing your overall percentage
- **Category names** with their individual percentages

## 🔍 Troubleshooting

### Problem: "I don't see the Score Overview option"
**Solution**: Click the blue "Update Template" button first - this adds the new section to your template.

### Problem: "PDF still doesn't have the donut chart"
**Solutions**:
1. Make sure you clicked "Update Template" AND "Save"
2. Check that "Score Overview (visual chart)" is ✅ checked
3. Try generating a new PDF report (old cached reports won't have it)

### Problem: "I can't find the PDF Report Designer"
**Navigation**:
- From Admin Dashboard → look for "Reports" or "PDF Designer" 
- Or go directly to: `http://localhost:3001/admin/reports/designer`

## 📱 Current Status
- ✅ **Results Page**: Donut chart working with "Total" at top
- ✅ **Analytics Page**: Donut chart working with "Total" at top  
- ⚙️ **PDF Reports**: Ready to configure (follow steps above)

## 🎨 Customization Options

In the PDF Report Designer, you can also:
- **Change colors**: Modify "Primary colour" and "Accent colour"
- **Add logo**: Upload a logo for your reports
- **Reorder sections**: Move the donut chart to different positions
- **Disable sections**: Uncheck any sections you don't want

---

**Need help?** Follow the steps above, and the donut chart will appear in your PDF reports!