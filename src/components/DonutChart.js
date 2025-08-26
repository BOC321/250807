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
    
    let totalScore = 0;
    let totalCategories = 0;

    Object.entries(categoryScores).forEach(([categoryTitle, score]) => {
      const percentage = Math.round(score * 100);
      
      // Find the category to get its ID for score ranges
      const category = categories?.find(c => c.title === categoryTitle);
      const ranges = scoreRanges?.categories?.[category?.id] || [];
      
      // Find the appropriate score range
      const range = ranges.find(r => percentage >= r.min_score && percentage <= r.max_score);
      
      // Abbreviate long category names if needed
      let displayLabel = categoryTitle;
      if (categoryTitle.length > 15) {
        displayLabel = categoryTitle.substring(0, 12) + '...';
      }
      
      labels.push(`${displayLabel} ${percentage}%`);
      data.push(percentage);
      backgroundColor.push(range ? `${range.color}80` : '#6c757d80'); // Add transparency
      borderColor.push(range ? range.color : '#6c757d');
      
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
          borderWidth: 2,
          hoverBorderWidth: 3,
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
          padding: 15,
          usePointStyle: true,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        enabled: false // Disable hover interactions as requested
      }
    },
    elements: {
      arc: {
        borderWidth: 2
      }
    },
    interaction: {
      intersect: false // Disable click interactions as requested
    }
  };

  const centerTextPlugin = {
    id: 'centerText',
    beforeDraw: (chart) => {
      const { width, height, ctx } = chart;
      ctx.restore();
      
      const fontSize = Math.min(width, height) / 12;
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const centerX = width / 2;
      const centerY = height / 2;
      
      // Draw "Total" text at the top of the inner circle
      ctx.fillStyle = '#333';
      ctx.font = `${fontSize * 0.7}px sans-serif`;
      ctx.fillText('Total', centerX, centerY - fontSize * 1.2);
      
      // Draw the percentage below the Total text
      ctx.fillStyle = '#000';
      ctx.font = `bold ${fontSize * 1.2}px sans-serif`;
      ctx.fillText(`${chartData.overallScore}%`, centerX, centerY - fontSize * 0.2);
      
      ctx.save();
    }
  };

  return (
    <div style={{ 
      width: '100%', 
      maxWidth: size, 
      margin: '0 auto',
      // Responsive adjustments for mobile
      '@media (max-width: 768px)': {
        maxWidth: '100%',
        padding: '0 1rem'
      }
    }}>
      {showTitle && (
        <h3 style={{ 
          textAlign: 'center', 
          marginBottom: '1rem',
          fontSize: '1.1rem',
          color: '#333'
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