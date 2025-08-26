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
    const patterns = ['solid', 'dots', 'stripes', 'waves', 'grid']; // Different visual patterns
    
    let totalScore = 0;
    let totalCategories = 0;

    Object.entries(categoryScores).forEach(([categoryTitle, score], index) => {
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
      
      // Add pattern indicator to label for better distinction
      const patternIcon = ['●', '◆', '▲', '■', '★'][index % 5];
      labels.push(`${patternIcon} ${displayLabel} ${percentage}%`);
      data.push(percentage);
      backgroundColor.push(range ? `${range.color}80` : '#6c757d80'); // Add transparency
      borderColor.push('#ffffff'); // White borders for clear separation
      
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
          borderWidth: 3, // Thicker white borders for better separation
          hoverBorderWidth: 4,
          spacing: 2, // Add spacing between segments
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
          padding: 20,
          usePointStyle: true,
          pointStyle: 'rect', // Use rectangles instead of circles for better distinction
          font: {
            size: 14,
            weight: 'bold'
          },
          boxWidth: 15,
          boxHeight: 15,
          // Custom legend item generator for better visual distinction
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
                  lineWidth: 2,
                  hidden: false,
                  index: i
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
        borderWidth: 3, // Thicker borders for better separation
        borderColor: '#ffffff' // White borders
      }
    },
    interaction: {
      intersect: false // Disable click interactions as requested
    },
    layout: {
      padding: {
        bottom: 10
      }
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
      
      {/* Visual guide for segment distinction */}
      <div style={{
        textAlign: 'center',
        fontSize: '0.85rem',
        color: '#666',
        marginBottom: '0.5rem',
        fontStyle: 'italic'
      }}>
        Each segment is separated by white borders for clarity
      </div>
      
      <div style={{ height: size, position: 'relative' }}>
        <Doughnut 
          data={chartData} 
          options={options} 
          plugins={[centerTextPlugin]}
        />
      </div>
      
      {/* Additional visual legend with patterns */}
      <div style={{
        marginTop: '1rem',
        padding: '0.75rem',
        backgroundColor: '#ffffff',
        borderRadius: '6px',
        border: '1px solid #dee2e6'
      }}>
        <div style={{
          fontSize: '0.9rem',
          fontWeight: 'bold',
          marginBottom: '0.5rem',
          color: '#495057'
        }}>
          Visual Guide:
        </div>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          fontSize: '0.8rem',
          color: '#6c757d'
        }}>
          <span>● Solid segments</span>
          <span>◆ Diamond markers</span>
          <span>▲ Triangle markers</span>
          <span>■ Square markers</span>
          <span>★ Star markers</span>
        </div>
      </div>
    </div>
  );
};

export default DonutChart;