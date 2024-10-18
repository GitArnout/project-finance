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
  Collapse,
  IconButton
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import './App.css';

const Home = () => {
  const [chartData, setChartData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [openRows, setOpenRows] = useState({});

  useEffect(() => {
    fetch('api/data')
      .then((response) => response.json())
      .then((data) => {
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
        setTransactions(transactions);
      })
      .catch((error) => {
        console.error('Error fetching transaction data:', error);
      });
  };

  const handleRowClick = (id) => {
    setOpenRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Compute income minus expenses (bij_data - af_data) and assign colors
  const balanceData = chartData?.bij_data.map((bij, index) => bij - chartData.af_data[index]);

  return (
    <Container>
      <Typography variant="h4" gutterBottom>
        Monthly Overview of Transactions
      </Typography>
      {chartData && (
        <Box sx={{ width: '100%', height: 400 }}>
          {/* First Bar Chart: Income vs. Expenses */}
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
            tooltip={{
              formatter: (params) => {
                const label = params.seriesName === 'Af' ? 'Totaal afschrijvingen' : 'Totaal bijschrijvingen';
                return `${label}: €${params.value}`;
              },
            }}
          />
        </Box>
      )}

      {/* Second Bar Chart: Balance (Income - Expenses) */}
      {chartData && (
        <Box sx={{ width: '100%', height: 400, mt: 4 }}>
          <BarChart
            series={[
              {
                name: 'Balance',
                data: balanceData,
                itemStyle: {
                  // Apply color based on value: red for negative, green for positive
                  color: (params) => (balanceData[params.dataIndex] < 0 ? 'red' : 'green'),
                },
              },
            ]}
            xAxis={[
              {
                data: chartData.labels,
                scaleType: 'band',
              },
            ]}
            height={400}
            margin={{ top: 10, bottom: 30, left: 40, right: 10 }}
            tooltip={{
              formatter: (params) => {
                const balance = params.value;
                return `Balance: €${balance}`;
              },
            }}
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
                <TableCell />
                <TableCell>Datum</TableCell>
                <TableCell>Naam / Beschrijving</TableCell>
                <TableCell>Bedrag</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((transaction) => (
                <React.Fragment key={transaction.id}>
                  <TableRow
                    hover
                    onClick={() => handleRowClick(transaction.id)}
                    sx={{ cursor: 'pointer' }}  // Add this line for pointer cursor
                  >
                    <TableCell>
                      <IconButton size="small">
                        {openRows[transaction.id] ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>{transaction.datum}</TableCell>
                    <TableCell>{transaction.company}</TableCell>
                    <TableCell>{transaction.af_bij === 'Af' ? '-' : ''}{transaction.bedrag_eur}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={4}>
                      <Collapse in={openRows[transaction.id]} timeout="auto" unmountOnExit>
                        <Box sx={{ margin: 1 }}>
                          <Typography variant="subtitle1" gutterBottom component="div">
                            Transaction Details
                          </Typography>
                          <Typography variant="body2">
                            <strong>Beschrijving:</strong> {transaction.company}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Mutatiesoort:</strong> {transaction.mutatiesoort}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Mededelingen:</strong> {transaction.mededelingen}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Label:</strong> {transaction.label}
                          </Typography>                          
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
};

export default Home;
