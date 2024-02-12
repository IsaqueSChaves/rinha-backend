const express = require('express');
const { insertTransaction, count, findById, findByTerm } = require('./database');
const { validationFilter, errorHandler } = require('./middleware');
const bodyParser = require('body-parser');
const cluster = require('cluster');
const process = require('process');

const TIMEOUT = Number(process.env.REQ_TIMEOUT) || 5000;

const app = express();

app.use(bodyParser.json());

app.post('/clientes/:id/transacoes', validationFilter, (req, res, _) => {
    const { descricao, tipo } = req.body;
    let { valor } = req.body;
    let { id } = req.params;
    insertTransaction(id, valor, descricao, tipo).then((result) => {
        console.log(result);
        res.status(200).location(`/pessoas/${id}`).end();
    }).catch(() => {
        res.status(422).end();
    });
});

app.get('/clientes/:id/extrato', async (req, res, _) => {
    try {
        let { accountId } = req.params;
        accountId = +accountId;
        console.log(accountId);
        // if (isNaN(accountId)) return res.status(404).end();

        const accountDetails = await getAccountDetailsById(accountId);
        // if (!accountDetails) return res.status(404).end();

        const balanceDetails = await getBalanceByAccountId(accountId);
        // if (!balanceDetails) return res.status(404).end();

        const recentTransactions = await getRecentTransactionsByAccountId(accountId);
        console.log(accountDetails);
        console.log(balanceDetails);
        console.log(recentTransactions);

        /* const response = {
            saldo: {
                total: balanceDetails.amount, 
                data_extrato: new Date().toISOString(), // Data atual como exemplo
                limite: accountDetails.limit_amount 
            },
            ultimas_transacoes: recentTransactions.map(tx => ({
                valor: tx.amount,
                tipo: tx.transaction_type,
                descricao: tx.description,
                realizada_em: tx.date.toISOString()
            }))
        }; */

        res.status(200)/* .json(response) */;
    } catch (err) {
        return res.status(404).end();
    }
});
app.use(errorHandler);

const numForks = Number(process.env.CLUSTER_WORKERS) || 1;

if (cluster.isPrimary && process.env.CLUSTER === 'true') {
    for (let i = 0; i < numForks; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log('Process exited with code', code);
    });
} else {
    const PORT = process.env.PORT || 8080;
    const serverApp = app.listen(PORT, () => {
        console.log(`index.js:${process.pid}:Listening on ${PORT}`);
    });

    if (process.env.USE_TIMEOUT === 'true') {
        serverApp.setTimeout(TIMEOUT);
        console.log(`Starting with timeout as ${TIMEOUT}ms`);

        serverApp.on('timeout', (socket) => {
            console.log(`Timing out connection`);
            socket.end();
        });
    }
}