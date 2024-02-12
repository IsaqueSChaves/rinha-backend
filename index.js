const express = require('express');
const { insertTransaction, getBalanceByAccountId, getTransactionsByAccountId } = require('./database');
const { validationFilter, errorHandler } = require('./middleware');
const bodyParser = require('body-parser');
/* 
const cluster = require('cluster');
const process = require('process');

const TIMEOUT = Number(process.env.REQ_TIMEOUT) || 5000;
*/

const app = express();
app.use(bodyParser.json());

app.post('/clientes/:id/transacoes', validationFilter, (req, res, _) => {
    const { descricao, tipo } = req.body;
    let { valor } = req.body;
    let { id } = req.params;
    insertTransaction(id, valor, descricao, tipo).then((result) => {
        return res.status(200).json(result);
    }).catch(() => {
        return res.status(422).end();
    });
});

app.get('/clientes/:id/extrato', async (req, res, _) => {
    try {
        const { id } = req.params;
        const accountId = +id;
        if (isNaN(accountId)) return res.status(404).end();

        const [recentTransactions, balanceDetails] = await Promise.all([
            getTransactionsByAccountId(accountId),
            getBalanceByAccountId(accountId)
        ]).catch(() => res.status(404).end());

        return res.status(200).json({
            saldo: {
                total: balanceDetails.amount,
                limite: balanceDetails.limit_amount,
                data_extrato: new Date()
            },
            ultimas_transacoes: recentTransactions
        });
    } catch (err) {
        return res.status(404).end();
    }
});

app.use(errorHandler);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`index.js:${process.pid}:Listening on ${PORT}`));
