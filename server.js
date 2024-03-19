require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const httpProxy = require('express-http-proxy');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

// Конфигурация доступных методов API для каждого клиента
const clientApiConfigs = {
  'client1': {
    methods: ['GET', 'POST'],
    targetAPI: 'https://exampleapi.com',
    jwtSecret: 'client1Secret'
  },
  'client2': {
    methods: ['GET'],
    targetAPI: 'https://anotherapi.com',
    jwtSecret: 'client2Secret'
  }
};

// Мидлвар для проверки JWT токена
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    const clientId = req.params.clientId;
    const clientConfig = clientApiConfigs[clientId];
    
    if (!clientConfig) {
      return res.sendStatus(401);
    }

    jwt.verify(token, clientConfig.jwtSecret, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

// Прокси для перенаправления запросов к целевому API
const apiProxy = (clientId) => httpProxy(clientApiConfigs[clientId].targetAPI, {
  proxyReqPathResolver: (req) => {
    return new Promise((resolve, reject) => {
      const method = req.method;
      if (clientApiConfigs[clientId].methods.includes(method)) {
        const newPath = require('url').parse(req.url).path;
        resolve(newPath);
      } else {
        reject(new Error('This method is not allowed for the client'));
      }
    });
  }
});

// Логирование всех запросов
app.use(morgan('combined'));

// Маршруты
app.use('/:clientId/api', authenticateJWT, (req, res, next) => {
  const clientId = req.params.clientId;
  if (clientApiConfigs[clientId]) {
    apiProxy(clientId)(req, res, next);
  } else {
    res.sendStatus(404);
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
