import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  CircularProgress,
  Box,
} from '@mui/material';

const FinanceOverview = () => {
  const [data, setData] = useState(null);
  const [labels, setLabels] = useState(null);
  const [transactionSums, setTransactionSums] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch transactions data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('/api/data');
        setData(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch labels data
  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const response = await axios.get('/api/getlabels');
        setLabels(response.data.details);
      } catch (error) {
        console.error('Error fetching labels:', error);
      }
    };

    fetchLabels();
  }, []);

  // Fetch transaction sums data
  useEffect(() => {
    const fetchTransactionSums = async () => {
      try {
        const response = await axios.get('/api/transaction-sums');
        setTransactionSums(response.data);
      } catch (error) {
        console.error('Error fetching transaction sums:', error);
      }
    };

    fetchTransactionSums();
  }, []);

  if (loading || !data || !labels || !transactionSums) {
    return <CircularProgress />;
  }

  const { af_data, bij_data } = data;

  // Calculate net savings for each month
  const netSavings = bij_data.map((income, index) => (income - af_data[index]).toFixed(2));

  // Calculate total income, total spending, and total net savings
  const totalIncome = bij_data.reduce((sum, income) => sum + parseFloat(income), 0).toFixed(2);
  const totalSpending = af_data.reduce((sum, spending) => sum + parseFloat(spending), 0).toFixed(2);
  const totalNetSavings = (totalIncome - totalSpending).toFixed(2);

  // Extract all INKOMSTEN labels
  const inkomstenCategory = labels.find(category => category.name === 'INKOMSTEN');
  const inkomstenLabels = [];

  const extractInkomstenLabels = (category) => {
    if (category.labels) {
      inkomstenLabels.push({ name: category.name, labels: category.labels });
    }
    if (category.children) {
      category.children.forEach(child => extractInkomstenLabels(child));
    }
  };

  if (inkomstenCategory) {
    extractInkomstenLabels(inkomstenCategory);
  }

  // Extract all UITGAVEN categories
  const uitgavenCategory = labels.find(category => category.name === 'UITGAVEN');
  const uitgavenCategories = [];

  const extractUitgavenCategories = (category) => {
    if (category.children) {
      category.children.forEach(child => {
        uitgavenCategories.push(child);
      });
    }
  };

  if (uitgavenCategory) {
    extractUitgavenCategories(uitgavenCategory);
  }

  // Convert month labels to "YYYY-MM" format
  const convertMonthLabel = (monthLabel) => {
    const date = new Date(monthLabel);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  };

  // Render INKOMSTEN table
  const renderInkomstenTable = () => {
    if (inkomstenLabels.length === 0) return null;

    return (
      <TableContainer component={Paper} sx={{ marginTop: 2 }}>
        <Table size="small" aria-label="inkomsten table">
          <TableHead>
            <TableRow sx={{ backgroundColor: 'rgb(25, 118, 210)' }}>
              <TableCell sx={{ color: 'white', paddingLeft: '10px' }}></TableCell>
              {data.labels.map((monthLabel, index) => (
                <TableCell key={index} sx={{ color: 'white' }} align="right">
                  {monthLabel}
                </TableCell>
              ))}
              <TableCell sx={{ color: 'white', paddingRight: '10px' }} align="right">
                Totaal
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {inkomstenLabels.map(category => (
              <React.Fragment key={category.name}>
                {category.name !== 'INKOMSTEN' && (
                  <TableRow>
                    <TableCell colSpan={data.labels.length + 2} sx={{ fontWeight: 'bold', paddingLeft: '10px' }}>
                      {category.name}
                    </TableCell>
                  </TableRow>
                )}
                {category.labels.map(label => (
                  <TableRow key={label.id}>
                    <TableCell sx={{ paddingLeft: '30px' }}>{label.name}</TableCell>
                    {data.labels.map((monthLabel, monthIndex) => {
                      const convertedMonthLabel = convertMonthLabel(monthLabel);
                      const sum = transactionSums.find(
                        sum => sum.label === label.name && sum.year_month === convertedMonthLabel
                      );
                      return (
                        <TableCell key={monthIndex} align="right">
                          €{sum ? parseFloat(sum.bedrag_eur).toFixed(2) : '0.00'}
                        </TableCell>
                      );
                    })}
                    <TableCell align="right">
                      €{transactionSums
                        .filter(sum => sum.label === label.name)
                        .reduce((total, item) => total + parseFloat(item.bedrag_eur), 0)
                        .toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

 // Render UITGAVEN tables
const renderUitgavenTables = () => {
  return uitgavenCategories.map(category => (
    <React.Fragment key={category.id}>
      <Typography variant="h6" sx={{ fontWeight: 'bold', marginTop: 3 }}>
        {category.name}
      </Typography>
      <TableContainer component={Paper} sx={{ marginTop: 2 }}>
        <Table size="small" aria-label={category.name}>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'rgb(25, 118, 210)' }}>
              <TableCell sx={{ color: 'white', paddingLeft: '10px' }}></TableCell>
              {data.labels.map((monthLabel, index) => (
                <TableCell key={index} sx={{ color: 'white' }} align="right">
                  {monthLabel}
                </TableCell>
              ))}
              <TableCell sx={{ color: 'white', paddingRight: '10px' }} align="right">
                Totaal
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {category.labels && category.labels.length > 0 && category.labels.map(label => (
              <TableRow key={label.id}>
                <TableCell sx={{ paddingLeft: '30px' }}>{label.name}</TableCell>
                {data.labels.map((monthLabel, monthIndex) => {
                  const convertedMonthLabel = convertMonthLabel(monthLabel);
                  const sum = transactionSums.find(
                    sum => sum.label === label.name && sum.year_month === convertedMonthLabel
                  );
                  return (
                    <TableCell key={monthIndex} align="right">
                      €{sum ? parseFloat(sum.bedrag_eur).toFixed(2) : '0.00'}
                    </TableCell>
                  );
                })}
                <TableCell align="right">
                  €{transactionSums
                    .filter(sum => sum.label === label.name)
                    .reduce((total, item) => total + parseFloat(item.bedrag_eur), 0)
                    .toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
            {category.children.length > 0 && category.children.map(subcategory => (
              <React.Fragment key={subcategory.id}>
                <TableRow>
                  <TableCell colSpan={data.labels.length + 2} sx={{ fontWeight: 'bold', paddingLeft: '10px' }}>
                    {subcategory.name}
                  </TableCell>
                </TableRow>
                {subcategory.labels.map(label => (
                  <TableRow key={label.id}>
                    <TableCell sx={{ paddingLeft: '30px' }}>{label.name}</TableCell>
                    {data.labels.map((monthLabel, monthIndex) => {
                      const convertedMonthLabel = convertMonthLabel(monthLabel);
                      const sum = transactionSums.find(
                        sum => sum.label === label.name && sum.year_month === convertedMonthLabel
                      );
                      return (
                        <TableCell key={monthIndex} align="right">
                          €{sum ? parseFloat(sum.bedrag_eur).toFixed(2) : '0.00'}
                        </TableCell>
                      );
                    })}
                    <TableCell align="right">
                      €{transactionSums
                        .filter(sum => sum.label === label.name)
                        .reduce((total, item) => total + parseFloat(item.bedrag_eur), 0)
                        .toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </React.Fragment>
  ));
};
  return (
    <Container>
      {/* Main Finance Table */}
      <Typography variant="h4" gutterBottom>
        Uitgaven overzicht
      </Typography>
      <Box sx={{ overflowX: 'auto', marginTop: 3 }}>
        <TableContainer component={Paper}>
          <Table size="small" aria-label="summary table">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'rgb(25, 118, 210)' }}>
                <TableCell sx={{ color: 'white', paddingLeft: '10px' }}></TableCell>
                {data.labels.map((label, index) => (
                  <TableCell key={index} sx={{ color: 'white' }} align="right">
                    {label}
                  </TableCell>
                ))}
                <TableCell sx={{ color: 'white', paddingRight: '10px' }} align="right">
                  Totaal
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[
                { label: 'Inkomen', data: bij_data, total: totalIncome },
                { label: 'Uitgaven', data: af_data, total: totalSpending },
                { label: 'Totaal Inkomen', data: netSavings, total: totalNetSavings, isBold: true },
              ].map((row, rowIndex) => (
                <TableRow key={row.label}>
                  <TableCell
                    component="th"
                    scope="row"
                    sx={{ paddingLeft: '10px', fontWeight: row.isBold ? 'bold' : 'normal' }}
                  >
                    {row.label}
                  </TableCell>
                  {row.data.map((value, index) => (
                    <TableCell
                      key={index}
                      sx={{
                        backgroundColor: index % 2 === 0 ? '#f5f5f5' : 'white',
                        color: parseFloat(value) < 0 ? 'red' : 'inherit',
                      }}
                      align="right"
                    >
                      €{parseFloat(value).toFixed(2)}
                    </TableCell>
                  ))}
                  <TableCell
                    align="right"
                    sx={{
                      paddingRight: '10px',
                      backgroundColor: rowIndex % 2 === 0 ? '#f5f5f5' : 'white',
                      fontWeight: row.isBold ? 'bold' : 'normal',
                      color: parseFloat(row.total) < 0 ? 'red' : 'inherit',
                    }}
                  >
                    €{row.total}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Render INKOMSTEN Table */}
      <Typography variant="h5" gutterBottom sx={{ marginTop: 5 }}>
        Inkomsten
      </Typography>
      {renderInkomstenTable()}

      {/* Render UITGAVEN Tables */}
      <Typography variant="h5" gutterBottom sx={{ marginTop: 5 }}>
        Uitgaven
      </Typography>
      {renderUitgavenTables()}
    </Container>
  );
};

export default FinanceOverview;