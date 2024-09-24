import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  Snackbar,
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

const LabelData = () => {
  const [years, setYears] = useState([]);
  const [months, setMonths] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [labels, setLabels] = useState([]);
  const [updateMessage, setUpdateMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [excludeLabeled, setExcludeLabeled] = useState(false);

  const monthMapping = {
    1: 'January',
    2: 'February',
    3: 'March',
    4: 'April',
    5: 'May',
    6: 'June',
    7: 'July',
    8: 'August',
    9: 'September',
    10: 'October',
    11: 'November',
    12: 'December',
  };

  useEffect(() => {
    setLoading(true);
    fetch('/api/getlabelmonth')
      .then(response => response.json())
      .then(data => {
        setYears(data.years || []);
        setMonths(data.months || []);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching label months:', error);
        setLoading(false);
      });

    fetch('/api/getlabels')
      .then(response => response.json())
      .then(data => {
        const labelList = processLabels(data.details);
        setLabels(labelList);
      })
      .catch(error => console.error('Error fetching labels:', error));
  }, []);

  useEffect(() => {
    if (selectedYear && selectedMonth) {
      fetchTransactions(selectedYear, selectedMonth);
    }
  }, [selectedYear, selectedMonth, excludeLabeled]);

  const processLabels = details => {
    const labelList = [];
    const traverse = (node, category) => {
      const currentCategory = category ? `${category} > ${node.name}` : node.name;
      if (!node.children || node.children.length === 0) {
        node.labels.forEach(label => {
          labelList.push({ name: label.name, category: currentCategory });
        });
      } else {
        node.children.forEach(child => traverse(child, currentCategory));
      }
    };
    details.forEach(root => traverse(root, ''));
    return labelList;
  };

  const handleYearChange = e => {
    const year = e.target.value;
    setSelectedYear(year);
    fetchTransactions(year, selectedMonth);
  };

  const handleMonthChange = e => {
    const month = e.target.value;
    setSelectedMonth(month);
    fetchTransactions(selectedYear, month);
  };

  const fetchTransactions = (year, month) => {
    if (year && month) {
      setLoading(true);
      const monthName = monthMapping[parseInt(month, 10)];
      fetch(`/api/transactions?month=${monthName} ${year}`)
        .then(response => response.json())
        .then(data => {
          let filteredTransactions = data;
          if (excludeLabeled) {
            filteredTransactions = data.filter(t => !t.label);
          }
          filteredTransactions.sort((a, b) => (a.label ? 1 : -1));
          setTransactions(filteredTransactions);
          setLoading(false);
        })
        .catch(error => {
          console.error('Error fetching transactions:', error);
          setLoading(false);
        });
    }
  };

  const handleLabelUpdate = (transactionId, selectedLabel) => {
    if (selectedLabel !== 'Selecteer label voor transactie') {
      fetch('/api/updateLabel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transactionId, labelName: selectedLabel }),
      })
        .then(response => response.json())
        .then(data => {
          setUpdateMessage(`De transactie: ${transactionId} is geupdate met label: ${selectedLabel}`);
          fetchTransactions(selectedYear, selectedMonth);
          setTimeout(() => setUpdateMessage(''), 10000);
        })
        .catch(error => console.error('Error updating label:', error));
    }
  };

  const handleApplySuggestedLabel = (transactionId, suggestedLabel) => {
    handleLabelUpdate(transactionId, suggestedLabel);
  };


  const columns = [
    { field: 'datum', headerName: 'Date', width: 180 },
    {
      field: 'company',
      headerName: 'Company',
      width: 300,
    },
    {
      field: 'bedrag_eur',
      headerName: 'Amount (€)',
      width: 100,
      renderCell: params => {
        if (params.row.af_bij) {
          return params.row.af_bij === 'Af' ? `-${params.row.bedrag_eur}` : params.row.bedrag_eur;
        }
        return params.row.bedrag_eur;
      },
    },
    {
      field: 'label',
      headerName: 'Label',
      width: 275,
      renderCell: (params) => (
        <FormControl variant="outlined" sx={{ minWidth: 270, width: 270 }}>
          <Select
            size="small"
            value={params.row.label || ''} // Use the 'label' property to pre-fill
            displayEmpty
            onChange={(e) => handleLabelUpdate(params.row.id, e.target.value)}
            renderValue={(selected) => {
              if (!selected) {
                return <em>Selecteer label voor transactie</em>; // Placeholder when no value is selected
              }
              return selected; // Display selected label
            }}
          >
            <MenuItem disabled value=""><em>Selecteer label voor transactie</em></MenuItem>
            {labels.map((label) => (
              <MenuItem key={label.name} value={label.name}>
                {label.category} &gt; {label.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ),
    },    
    {
      field: 'suggested_label',
      headerName: 'Suggested Label',
      width: 300,
      renderCell: params => (
        <>
          {params.row.suggested_label} ({Math.round(params.row.label_probability * 100)}% probability)
        </>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 180,
      renderCell: params => (
        <Button
          variant="contained"
          color="primary"
          size="small"
          onClick={() => handleApplySuggestedLabel(params.row.id, params.row.suggested_label)}
        >
          Apply
        </Button>
      ),
    },
  ];

  return (
    <Container>
      <Typography variant="h4" gutterBottom>
        Select Year and Month
      </Typography>
      <Box display="flex" justifyContent="space-between" mb={3}>
        <FormControl variant="outlined" sx={{ minWidth: 120 }}>
          <Select size="small" value={selectedYear} onChange={handleYearChange} displayEmpty>
            <MenuItem value="" disabled>
              Select Year
            </MenuItem>
            {years.map(year => (
              <MenuItem key={year} value={year}>
                {year}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl variant="outlined" sx={{ minWidth: 120 }}>
          <Select size="small" value={selectedMonth} onChange={handleMonthChange} displayEmpty>
            <MenuItem value="" disabled>
              Select Month
            </MenuItem>
            {months.map(month => (
              <MenuItem key={month} value={month}>
                {monthMapping[month]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <FormControlLabel
        control={<Checkbox checked={excludeLabeled} onChange={() => setExcludeLabeled(!excludeLabeled)} color="primary" />}
        label="Exclude labeled transactions"
      />
      <Typography variant="h5" gutterBottom>
        Transactions
      </Typography>
      {loading ? (
        <Box display="flex" justifyContent="center" mt={2}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ height: 400, width: '100%' }}>
          <DataGrid
            rows={transactions}
            columns={columns}
            pageSize={5}
            rowsPerPageOptions={[5, 10, 25]}
            getRowId={row => row.id}
            rowHeight={35}
            autoHeight
          />
        </Box>
      )}
      {updateMessage && (
        <Snackbar open={!!updateMessage} autoHideDuration={6000} onClose={() => setUpdateMessage('')}>
          <Alert onClose={() => setUpdateMessage('')} severity="success">
            {updateMessage}
          </Alert>
        </Snackbar>
      )}
    </Container>
  );
};

export default LabelData;
