import React, { useEffect, useState } from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
} from '@mui/material';
import './App.css';

const Home = () => {
  const [chartData, setChartData] = useState(null);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    fetch('api/data')
      .then((response) => response.json())
      .then((data) => {
        console.log('Fetched data:', data);
        setChartData(data);
      })
      .catch((error) => {
        console.error('Error fetching data:', error);
      });
  }, []);

  const handleBarClick = (event, params) => {
    if (!params) return;

    const { dataIndex } = params;
    const monthLabel = chartData.labels[dataIndex];
    
    fetch(`api/transactions?month=${monthLabel}`)
      .then((response) => response.json())
      .then((transactions) => {
        console.log('Fetched transactions:', transactions);
        setTransactions(transactions);
      })
      .catch((error) => {
        console.error('Error fetching transaction data:', error);
      });
  };

  return (
    <Container>
      <Typography variant="h4" gutterBottom>
        Monthly Overview of Transactions
      </Typography>
      {chartData && (
        <Box sx={{ width: '100%', height: 400 }}>
          <BarChart
            series={[
              { name: 'Af', data: chartData.af_data },
              { name: 'Bij', data: chartData.bij_data },
            ]}
            xAxis={[
              {
                data: chartData.labels,
                scaleType: 'band',
              },
            ]}
            height={400}
            margin={{ top: 10, bottom: 30, left: 40, right: 10 }}
            onItemClick={handleBarClick}
          />
        </Box>
      )}
      <Typography variant="h5" gutterBottom>
        Transactions
      </Typography>
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((transaction, index) => (
                <TableRow key={index}>
                  <TableCell>{transaction.datum}</TableCell>
                  <TableCell>{transaction.company}</TableCell>
                  <TableCell>€ {transaction.bedrag_eur}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
};

export default Home;
