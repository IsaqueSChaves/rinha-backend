const express = require('express');
const { Router } = require('express');
const { insertTransaction, count, findById, findByTerm } = require('./database');
const { validationFilter, errorHandler } = require('./middleware');
const bodyParser = require('body-parser');
const cluster = require('cluster');
const process = require('process');

const TIMEOUT = Number(process.env.REQ_TIMEOUT) || 5000;

const app = express();
const transactionsRouter = Router();

app.use(bodyParser.json());
app.use('/clientes', transactionsRouter);

transactionsRouter.post('/:id/transacoes', validationFilter, (req, res, _) => {
    const { id, valor, descricao, tipo } = req;
    // find by id
    // test everything before do another request
    insertTransaction(id, valor, descricao, tipo).then((result) => {
        console.log(result);
        res.status(200).location(`/pessoas/${id}`).end();
    }).catch(() => {
        res.status(422).end();
    });
});

transactionsRouter.get('/:id', (req, res, _) => {
    findById(req.params.id).then((queryResult) => {
        const [result] = queryResult.rows;
        if (!result) {
            return res.status(404).end();
        }
        res.json(result).end();
    }).catch(() => {
        res.status(404).end();
    });
});

transactionsRouter.get('/', (req, res, _) => {
    if (!req.query['t']) {
        return res.status(400).end();
    };

    findByTerm(req.query.t).then((queryResults) => {
        res.json(queryResults.rows).end();
    }).catch(() => {
        res.status(404).end();
    });
});

app.get('/contagem-pessoas', (_, res) => {
    count().then((queryResult) => {
        const [countResult] = queryResult.rows;
        res.json(countResult).end();
    }).catch(() => {
        res.status(422).end();
    });
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