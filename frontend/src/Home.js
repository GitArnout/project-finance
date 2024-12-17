import React, { useEffect, useState } from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
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
  IconButton,
  Grid,
  CircularProgress
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import './App.css';
import axios from 'axios';

const Home = () => {
  const [chartData, setChartData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [savingsData, setSavingsData] = useState([]);
  const [labelsData, setLabelsData] = useState([]);
  const [transactionSums, setTransactionSums] = useState([]);
  const [openRows, setOpenRows] = useState({});
  const [identifier, setIdentifier] = useState(null);
  const [id, setId] = useState(undefined);
  const [combinedDataLogged, setCombinedDataLogged] = useState(false);
  const [uitgavenData, setUitgavenData] = useState([]);
  const [vasteLastenData, setVasteLastenData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [secondPieChartData, setSecondPieChartData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const chartResponse = await fetch('api/data');
        const chartData = await chartResponse.json();
        setChartData(chartData);

        const savingsResponse = await fetch('api/getsavings');
        const savingsData = await savingsResponse.json();
        setSavingsData(savingsData);

        const labelsResponse = await fetch('api/getlabels');
        const labelsData = await labelsResponse.json();
        setLabelsData(labelsData.details);

        const transactionSumsResponse = await fetch('api/transaction-sums');
        const transactionSumsData = await transactionSumsResponse.json();
        setTransactionSums(transactionSumsData);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (labelsData.length > 0 && transactionSums.length > 0 && !combinedDataLogged) {
      // Function to recursively map labels and their monthly sums
      const mapLabels = (node) => {
        const nodeCopy = { ...node };
        if (node.labels) {
          nodeCopy.labels = node.labels.map(label => {
            const labelCopy = { ...label };
            labelCopy.monthly_sums = transactionSums
              .filter(transaction => transaction.label === label.name)
              .map(transaction => ({
                month: transaction.year_month,
                amount: parseFloat(transaction.bedrag_eur)
              }));
            return labelCopy;
          });
        }
        if (node.children) {
          nodeCopy.children = node.children.map(mapLabels);
        }
        return nodeCopy;
      };

      // Combine labels and transaction sums
      const combinedData = labelsData.map(mapLabels);

      setCombinedDataLogged(true);

      // Extract UITGAVEN data for the month 2024-10
      const uitgavenCategory = combinedData.find(category => category.name === 'UITGAVEN');
      if (uitgavenCategory) {
        const uitgavenData = uitgavenCategory.children.map(child => {
          const totalAmount = child.labels.reduce((sum, label) => {
            const monthlySum = label.monthly_sums.find(sum => sum.month === '2024-10');
            return sum + (monthlySum ? monthlySum.amount : 0);
          }, 0);
          return {
            name: child.name,
            amount: totalAmount
          };
        });
        setUitgavenData(uitgavenData);
      }

      // Check for VASTE LASTEN category within UITGAVEN
      const vasteLastenCategory = uitgavenCategory.children.find(category => category.name === 'VASTE LASTEN');
      if (vasteLastenCategory) {
        const vasteLastenData = vasteLastenCategory.children.map(child => {
          const totalAmount = child.labels.reduce((sum, label) => {
            const monthlySum = label.monthly_sums.find(sum => sum.month === '2024-10');
            return sum + (monthlySum ? monthlySum.amount : 0);
          }, 0);
          return {
            name: child.name,
            amount: totalAmount
          };
        });
        setVasteLastenData(vasteLastenData);
      }
    }
  }, [labelsData, transactionSums, combinedDataLogged]);

  useEffect(() => {
    const fetchSecondPieChartData = async () => {
      try {
        const response = await axios.get('/api/fetch-transactions-overview');
        const data = response.data;

        // Find the UITGAVEN category
        const uitgavenCategory = data.find(category => category.name === 'UITGAVEN');

        if (uitgavenCategory) {
          // Extract the first subcategories and their transactions_total
          const pieChartData = uitgavenCategory.subcategories.map((subcategory, index) => ({
            id: index,
            value: subcategory.transactions_total,
            label: subcategory.name
          }));

          setSecondPieChartData(pieChartData);
          console.log('Second Pie Chart Data:', pieChartData);
        }
      } catch (error) {
        console.error('Error fetching transactions overview:', error);
      }
    };

    fetchSecondPieChartData();
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

  const handlePieClick = (event, itemIdentifier, item) => {
    setId(item.id);
    setIdentifier(itemIdentifier);
  };

  const formatObject = (obj) => {
    if (obj === null) {
      return '  undefined';
    }
    return JSON.stringify(obj, null, 2)
      .split('\n')
      .map((l) => `  ${l}`)
      .join('\n');
  };

  // Compute income minus expenses (bij_data - af_data)
  const balanceData = chartData?.bij_data.map((bij, index) => bij - chartData.af_data[index]);

  // Concatenate month names to 3 characters
  const shortLabels = chartData?.labels.map(label => label.substring(0, 3));

  // Prepare savings data
  const savingsMap = savingsData.reduce((acc, item) => {
    acc[item.year_month] = parseFloat(item.bedrag_eur);
    return acc;
  }, {});

  const savingsDataPerMonth = chartData?.labels.map(label => {
    const [month, year] = label.split(' ');
    const monthNumber = new Date(`${month} 1, ${year}`).toISOString().substring(5, 7);
    const yearMonth = `${year}-${monthNumber}`;
    return savingsMap[yearMonth] || 0;
  });

  // Example pie chart data
  const pieChartData = uitgavenData.map((item, index) => ({
    id: index + 1,
    value: item.amount,
    label: item.name
  }));

  // Add VASTE LASTEN data to the pie chart data
  const vasteLastenPieChartData = vasteLastenData.map((item, index) => ({
    id: index + 1 + pieChartData.length,
    value: item.amount,
    label: item.name
  }));

  const items = [
    { value: 10, label: 'Series A' },
    { id: 'id_B', value: 15, label: 'Series B' },
    { id: 'id_C', value: 20, label: 'Series C' },
  ];


  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Container>
      <Typography variant="h4" gutterBottom>
        Monthly Overview of Transactions
      </Typography>

      {chartData && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Box sx={{ width: '100%', height: 400 }}>
              <BarChart
                series={[
                  {
                    name: 'Balance',
                    data: balanceData,
                    label: 'Netto saldo',
                  },
                ]}
                xAxis={[
                  {
                    data: shortLabels,
                    scaleType: 'band',
                    
                  },
                ]}
                yAxis={[
                  {
                    colorMap: {
                      type: 'piecewise',
                      thresholds: [0],
                      colors: ['red', 'green'],
                    },
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
                onItemClick={handleBarClick}
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ width: '100%', height: 400 }}>
              <BarChart
                series={[
                  {
                    name: 'Savings',
                    data: savingsDataPerMonth,
                    label: 'Sparen',
                  },
                ]}
                xAxis={[
                  {
                    data: shortLabels,
                    scaleType: 'band',
                  },
                ]}
                yAxis={[
                  {
                    colorMap: {
                      type: 'piecewise',
                      thresholds: [0],
                      colors: ['red', 'green'],
                    },
                  },
                ]}
                height={400}
                margin={{ top: 10, bottom: 30, left: 40, right: 10 }}
                tooltip={{
                  formatter: (params) => {
                    const savings = params.value;
                    return `Savings: €${savings}`;
                  },
                }}
              />
            </Box>
          </Grid>
        </Grid>
      )}

      <Box sx={{ width: '100%', mt: 4 }}>
        <Grid container spacing={2} justifyContent="flex-start">
          <Grid item>
            <PieChart
              series={[
                {
                  data: secondPieChartData,
                },
              ]}
              width={600}
              height={200}
              margin={{ right: 220 }}
            />
          </Grid>
          <Grid item>
            <PieChart
              series={[
                {
                  data: items,
                },
              ]}
              width={400}
              height={200}
            />
          </Grid>
        </Grid>
      </Box>

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
                    sx={{ cursor: 'pointer' }}
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
                        <Box sx={{ margin: 0 }}>
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