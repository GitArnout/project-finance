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

  if (loading || !data || !labels) {
    return <CircularProgress />;
  }

  const { af_data, bij_data } = data;

  // Calculate net savings for each month
  const netSavings = bij_data.map((income, index) => (income - af_data[index]).toFixed(2));

  // Calculate total income, total spending, and total net savings
  const totalIncome = bij_data.reduce((sum, income) => sum + parseFloat(income), 0).toFixed(2);
  const totalSpending = af_data.reduce((sum, spending) => sum + parseFloat(spending), 0).toFixed(2);
  const totalNetSavings = (totalIncome - totalSpending).toFixed(2);

  // Helper function to render individual tables for categories/labels
  const renderTablesForLabels = (category) => {
    return (
      <TableContainer component={Paper} key={category.id} sx={{ marginTop: 2 }}>
        <Table size="small" aria-label={category.name}>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'rgb(25, 118, 210)' }}>
              <TableCell sx={{ color: 'white', paddingLeft: '10px' }}>{category.name}</TableCell>
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
            {/* Render each main category */}
            {category.children.map((subcategory, subIndex) => (
              <React.Fragment key={subIndex}>
                {/* Main category row (like "Salaris") */}
                <TableRow>
                  <TableCell sx={{ paddingLeft: '10px', fontWeight: 'bold' }}>{subcategory.name}</TableCell>
                  {data.labels.map((monthValue, monthIndex) => (
                    <TableCell key={monthIndex} align="right">
                      {/* Assuming main category does not have specific values */}
                    </TableCell>
                  ))}
                  <TableCell align="right"></TableCell>
                </TableRow>
  
                {/* Render each subcategory under the main category */}
                {subcategory.children.map((label, labelIndex) => (
                  <TableRow key={labelIndex}>
                    <TableCell sx={{ paddingLeft: '20px' }}>{label.name}</TableCell>
                    {bij_data.map((value, monthIndex) => (
                      <TableCell key={monthIndex} align="right">
                        {/* Display actual value for the subcategories */}
                        €{parseFloat(value).toFixed(2)}
                      </TableCell>
                    ))}
                    <TableCell align="right">€{totalIncome}</TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
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
              {[{ label: 'Inkomen', data: bij_data, total: totalIncome },
                { label: 'Uitgaven', data: af_data, total: totalSpending },
                { label: 'Totaal Inkomen', data: netSavings, total: totalNetSavings, isBold: true }
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

      {/* Render Separate Tables for INKOMSTEN */}
      <Typography variant="h5" gutterBottom sx={{ marginTop: 5 }}>
        INKOMSTEN
      </Typography>
      {labels
        .filter((category) => category.name === 'INKOMSTEN')
        .map((category) => renderTablesForLabels(category))}
    </Container>
  );
};

export default FinanceOverview;
