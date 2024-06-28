import React, { useEffect, useState, useRef } from 'react';
import Chart from 'chart.js/auto';
import './App.css';

const Home = () => {
  const [chartData, setChartData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    fetch('api/data')
      .then(response => response.json())
      .then(data => {
        console.log('Fetched data:', data);
        setChartData(data);
        renderChart(data);
      })
      .catch(error => {
        console.error('Error fetching data:', error);
      });
  }, []);

  const renderChart = (data) => {
    const ctx = document.getElementById('barChart').getContext('2d');
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }
    const chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Af',
          data: data.af_data,
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }, {
          label: 'Bij',
          data: data.bij_data,
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true
          }
        },
        onClick: handleClick
      }
    });
    chartInstanceRef.current = chartInstance;
  };

  const handleClick = (event) => {
    const chartInstance = chartInstanceRef.current;

    if (!chartInstance) {
      console.error('Chart instance is not defined');
      return;
    }

    const points = chartInstance.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);

    if (points.length) {
      const firstPoint = points[0];
      const monthIndex = firstPoint.index;
      const monthLabel = chartInstance.data.labels[monthIndex];

      console.log('monthIndex:', monthIndex);
      console.log('monthLabel:', monthLabel);

      if (!monthLabel) {
        console.error('Invalid monthLabel:', monthLabel);
        return;
      }

      fetch(`api/transactions?month=${monthLabel}`)
        .then(response => response.json())
        .then(transactions => {
          console.log('Fetched transactions:', transactions);
          setTransactions(transactions);
        })
        .catch(error => {
          console.error('Error fetching transaction data:', error);
        });
    }
  };

  return (
    <div>
      <h1>Monthly Overview of Transactions</h1>
      <canvas id="barChart" width="800" height="400"></canvas>
      <div id="transactionTable">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Company</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction, index) => (
              <tr key={index}>
                <td>{transaction.date}</td>
                <td>{transaction.company}</td>
                <td>{transaction.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Home;
