import React, { useState, useEffect } from 'react';

const LabelData = () => {
    const [years, setYears] = useState([]);
    const [months, setMonths] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [transactions, setTransactions] = useState([]);
    const [labels, setLabels] = useState([]);
    const [updateMessage, setUpdateMessage] = useState('');

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
        12: 'December'
    };

    useEffect(() => {
        fetch('/api/getlabelmonth')
            .then(response => response.json())
            .then(data => {
                setYears(data.years || []);
                setMonths(data.months || []);
            })
            .catch(error => console.error('Error fetching label months:', error));

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
    }, [selectedYear, selectedMonth]);

    const processLabels = (details) => {
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

    const handleYearChange = (e) => {
        const year = e.target.value;
        setSelectedYear(year);
        fetchTransactions(year, selectedMonth);
    };

    const handleMonthChange = (e) => {
        const month = e.target.value;
        setSelectedMonth(month);
        fetchTransactions(selectedYear, month);
    };

    const fetchTransactions = (year, month) => {
        if (year && month) {
            const monthName = monthMapping[parseInt(month, 10)];
            fetch(`/api/transactions?month=${monthName} ${year}`)
                .then(response => response.json())
                .then(data => {
                    setTransactions(data);
                })
                .catch(error => console.error('Error fetching transactions:', error));
        }
    };

    const handleLabelUpdate = (transactionId, selectedLabel) => {
        if (selectedLabel !== 'Selecteer label voor transactie') {
            fetch('/api/updateLabel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ transactionId, labelName: selectedLabel })
            })
                .then(response => response.json())
                .then(data => {
                    setUpdateMessage(`De transactie: ${transactionId} is geupdate met label: ${selectedLabel}`);
                    fetchTransactions(selectedYear, selectedMonth);  // Refresh transactions after update
                    setTimeout(() => setUpdateMessage(''), 10000);
                })
                .catch(error => console.error('Error updating label:', error));
        }
    };

    const separateTransactions = () => {
        const prefilled = transactions.filter(transaction => transaction.label);
        const nonPrefilled = transactions.filter(transaction => !transaction.label);
        return { prefilled, nonPrefilled };
    };

    const { prefilled, nonPrefilled } = separateTransactions();

    return (
        <div>
            <h1>Select Year and Month</h1>
            <div>
                <label htmlFor="year">Year:</label>
                <select id="year" value={selectedYear} onChange={handleYearChange}>
                    <option value="">Select Year</option>
                    {years.map(year => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="month">Month:</label>
                <select id="month" value={selectedMonth} onChange={handleMonthChange}>
                    <option value="">Select Month</option>
                    {months.map(month => (
                        <option key={month} value={month}>{monthMapping[month]}</option>
                    ))}
                </select>
            </div>
            <div>
                <h2>Transactions with Pre-filled Labels</h2>
                <ul>
                    {prefilled.map((transaction, index) => (
                        <li key={index}>
                            {transaction.datum} - {transaction.company} - €
                            {transaction.bedrag_eur !== undefined ? parseFloat(transaction.bedrag_eur).toFixed(2) : 'N/A'}
                            <select
                                value={transaction.label || "Selecteer label voor transactie"}
                                onChange={(e) => handleLabelUpdate(transaction.id, e.target.value)}
                            >
                                <option disabled>Selecteer label voor transactie</option>
                                {labels.map(label => (
                                    <option key={label.name} value={label.name}>{label.category} &gt; {label.name}</option>
                                ))}
                            </select>
                        </li>
                    ))}
                </ul>
            </div>
            <div>
                <h2>Transactions without Labels</h2>
                <ul>
                    {nonPrefilled.map((transaction, index) => (
                        <li key={index}>
                            {transaction.datum} - {transaction.company} - €
                            {transaction.bedrag_eur !== undefined ? parseFloat(transaction.bedrag_eur).toFixed(2) : 'N/A'}
                            <select
                                value="Selecteer label voor transactie"
                                onChange={(e) => handleLabelUpdate(transaction.id, e.target.value)}
                            >
                                <option disabled>Selecteer label voor transactie</option>
                                {labels.map(label => (
                                    <option key={label.name} value={label.name}>{label.category} &gt; {label.name}</option>
                                ))}
                            </select>
                        </li>
                    ))}
                </ul>
            </div>
            {updateMessage && <div className="update-message">{updateMessage}</div>}
        </div>
    );
};

export default LabelData;
