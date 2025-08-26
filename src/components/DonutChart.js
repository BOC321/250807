import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const DonutChart = ({ 
  categoryScores, 
  scoreRanges, 
  categories, 
  showTitle = true,
  size = 300 
}) => {
  // Calculate data for the donut chart
  const getChartData = () => {
    const labels = [];
    const data = [];
    const backgroundColor = [];
    const borderColor = [];
    
    // Define alternating opacity levels and patterns for visual distinction
    const opacityLevels = [1.0, 0.7, 0.4, 0.9, 0.6]; // Different opacity levels
    const borderStyles = ['solid', 'dashed', 'dotted', 'double', 'groove'];
    
    let totalScore = 0;
    let totalCategories = 0;

    Object.entries(categoryScores).forEach(([categoryTitle, score], index) => {
      const percentage = Math.round(score * 100);
      
      // Find the category to get its ID for score ranges
      const category = categories?.find(c => c.title === categoryTitle);
      const ranges = scoreRanges?.categories?.[category?.id] || [];
      
      // Find the appropriate score range
      const range = ranges.find(r => percentage >= r.min_score && percentage <= r.max_score);
      
      // Use base color but with different opacity levels for distinction
      const baseColor = range ? range.color : '#6c757d';
      const opacity = opacityLevels[index % opacityLevels.length];
      
      // Abbreviate long category names if needed
      let displayLabel = categoryTitle;
      if (categoryTitle.length > 15) {
        displayLabel = categoryTitle.substring(0, 12) + '...';
      }
      
      // Add pattern indicators and opacity info to label
      const patternIcons = ['●', '◐', '○', '◑', '◒'];
      const patternIcon = patternIcons[index % patternIcons.length];
      labels.push(`${patternIcon} ${displayLabel} ${percentage}%`);
      data.push(percentage);
      
      // Apply different opacity levels to the same base color
      backgroundColor.push(`${baseColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`);
      borderColor.push('#000000'); // Black borders for maximum contrast
      
      totalScore += percentage;
      totalCategories++;
    });

    // Calculate overall score as average of category scores
    const overallScore = totalCategories > 0 ? Math.round(totalScore / totalCategories) : 0;

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor,
          borderColor,
          borderWidth: 4, // Even thicker borders for better separation
          hoverBorderWidth: 5,
          spacing: 4, // More spacing between segments
        },
      ],
      overallScore
    };
  };

  const chartData = getChartData();

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 25,
          usePointStyle: true,
          pointStyle: 'rectRounded',
          font: {
            size: 15,
            weight: 'bold'
          },
          boxWidth: 20,
          boxHeight: 20,
          // Custom legend item generator with opacity distinction
          generateLabels: function(chart) {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label, i) => {
                const dataset = data.datasets[0];
                const backgroundColor = dataset.backgroundColor[i];
                const borderColor = dataset.borderColor[i];
                
                return {
                  text: label,
                  fillStyle: backgroundColor,
                  strokeStyle: borderColor,
                  lineWidth: 3,
                  hidden: false,
                  index: i,
                  pointStyle: 'rectRounded'
                };
              });
            }
            return [];
          }
        }
      },
      tooltip: {
        enabled: false // Disable hover interactions as requested
      }
    },
    elements: {
      arc: {
        borderWidth: 4, // Thick black borders for maximum separation
        borderColor: '#000000',
        spacing: 4 // More spacing between segments
      }
    },
    interaction: {
      intersect: false // Disable click interactions as requested
    },
    layout: {
      padding: {
        bottom: 15,
        top: 10,
        left: 10,
        right: 10
      }
    },
    // Add custom styling for better visual separation
    cutout: '60%', // Larger donut hole for better proportion
    radius: '90%' // Slightly smaller radius for better spacing
  };

  const centerTextPlugin = {
    id: 'centerText',
    beforeDraw: (chart) => {
      const { width, height, ctx } = chart;
      ctx.restore();
      
      const centerX = width / 2;
      const centerY = height / 2;
      
      // Make font sizes much smaller to fit better in the center circle
      const baseFontSize = Math.min(width, height) / 18; // Smaller base size
      const titleFontSize = baseFontSize * 0.9; // Smaller "Total" text
      const scoreFontSize = baseFontSize * 1.6; // Smaller percentage
      
      // Move the entire text group up significantly to center it in the donut hole
      const textGroupOffset = baseFontSize * 1.5; // Move up by 1.5x the base font size
      
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Draw "Total" text centered, positioned above center but moved up as a group
      ctx.fillStyle = '#666';
      ctx.font = `${titleFontSize}px sans-serif`;
      ctx.fillText('Total', centerX, (centerY - textGroupOffset) - scoreFontSize * 0.3);
      
      // Draw the percentage centered, positioned below Total but moved up as a group
      ctx.fillStyle = '#000';
      ctx.font = `bold ${scoreFontSize}px sans-serif`;
      ctx.fillText(`${chartData.overallScore}%`, centerX, (centerY - textGroupOffset) + titleFontSize * 0.5);
      
      ctx.save();
    }
  };

  return (
    <div style={{ 
      width: '100%', 
      maxWidth: size, 
      margin: '0 auto',
      padding: '1rem',
      borderRadius: '8px',
      backgroundColor: '#f8f9fa',
      border: '1px solid #e9ecef',
      // Responsive adjustments for mobile
      '@media (max-width: 768px)': {
        maxWidth: '100%',
        padding: '0.5rem'
      }
    }}>
      {showTitle && (
        <h3 style={{ 
          textAlign: 'center', 
          marginBottom: '1rem',
          fontSize: '1.2rem',
          color: '#333',
          fontWeight: 'bold'
        }}>
          Score Overview
        </h3>
      )}
      
      <div style={{ height: size, position: 'relative' }}>
        <Doughnut 
          data={chartData} 
          options={options} 
          plugins={[centerTextPlugin]}
        />
      </div>
    </div>
  );
};

export default DonutChart;