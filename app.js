//20240709: agregado de Flujo de predicacion telefonica
//CÓDIGO JEANFRAN

const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot')
const express = require('express');
const QRPortalWeb = require('@bot-whatsapp/portal')
const BaileysProvider = require('@bot-whatsapp/provider/baileys')
const MockAdapter = require('@bot-whatsapp/database/mock')
const nodemailer = require('nodemailer');
const app = express();
app.use(express.json());
const axios = require('axios');
const { delay } = require('@whiskeysockets/baileys');
const MSSQLADAPTER = require('@bot-whatsapp/database/mssql');
const fs = require('fs');
const sql = require('mssql');


const MSSQL_DB_HOST = 'localhost';
const MSSQL_DB_USER = 'sa';
const MSSQL_DB_PASSWORD = 'Galois#2024';
const MSSQL_DB_NAME = 'predicapp-prod';
const MSSQL_DB_PORT = 1433;

//const MSSQL_DB_HOST = 'predicapp.database.windows.net';
//const MSSQL_DB_USER = 'sa_root';
//const MSSQL_DB_PASSWORD = 'PamsWWIDWOU24.';
//const MSSQL_DB_NAME = 'predicapp';
//const MSSQL_DB_PORT = 1433;

//INICIO código OCR
const T = require("tesseract.js");

// Configurar la conexión a SQL Server
const config = {
  user: 'sa',
  password: 'Galois#2024',
  server: 'localhost',
  database: 'predicapp-prod',
  options: {
    trustedConnection: true,
    encrypt: true,
    enableArithAbort: true,
    trustServerCertificate: true,
},
};

// Función para insertar el texto en la base de datos
async function insertarTextoEnBD(texto) {
  try {
    await sql.connect(config);
    await sql.query`EXEC sp_load_Salidas_Texto ${texto}`;
    console.log("Texto insertado en la base de datos correctamente.");
  } catch (err) {
    console.error("Error al insertar el texto en la base de datos:", err);
  }
}

// Realizar OCR y guardar el resultado en la base de datos
T.recognize('G:\Mi unidad\\PredicApp\\Salidas\\Salidas.jpg', 'spa', { logger: e => console.log(e) })
  .then(out => {
    const textoExtraido = out.data.text;
    // Insertar el texto en la base de datos
    insertarTextoEnBD(textoExtraido);
  })
  .catch(err => {
    console.error("Error al realizar OCR:", err);
  });

//FIN código OCR

// Cargar la lista desde el archivo JSON
const rawData = fs.readFileSync('blacklist.json', 'utf8');
const blacklistObj = JSON.parse(rawData);
const blacklist = blacklistObj.blacklist;


// Función para guardar la lista negra en el archivo JSON
function saveBlacklistToFile() {
    const blacklistObj = { blacklist };
    try {
      fs.writeFileSync('blacklist.json', JSON.stringify(blacklistObj, null, 2), 'utf8');
      console.log('Lista negra guardada en el archivo JSON.');
    } catch (error) {
      console.error('Error al guardar la lista negra en el archivo JSON:', error);
    }
  }


// Declarar el adapterDB fuera de la función main
const adapterDBmssql = new MSSQLADAPTER({
    server: MSSQL_DB_HOST,
    user: MSSQL_DB_USER,
    database: MSSQL_DB_NAME,
    password: MSSQL_DB_PASSWORD,
    port: MSSQL_DB_PORT,
    options: {
        encrypt: true,
        trustServerCertificate: true,
    },
});


async function executeQuery(query) {
    let pool;
    try {
        const adapterDBmssql = new MSSQLADAPTER({
            server: MSSQL_DB_HOST,
            user: MSSQL_DB_USER,
            database: MSSQL_DB_NAME,
            password: MSSQL_DB_PASSWORD,
            port: MSSQL_DB_PORT,
            options: {
                encrypt: true,
                trustServerCertificate: true,
            },
        });

        pool = await sql.connect(adapterDBmssql);

        const result = await pool.request().query(query);

        // Retornar los resultados en lugar de imprimirlos
        return result.recordset;
    } catch (err) {
        console.error('Error al ejecutar la consulta:', err);
        // Puedes lanzar el error para manejarlo fuera de esta función si es necesario
        throw err;
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}


//para el sp
async function executeSp(query) {
    let pool;
    try {
        const adapterDBmssql = new MSSQLADAPTER({
            server: MSSQL_DB_HOST,
            user: MSSQL_DB_USER,
            database: MSSQL_DB_NAME,
            password: MSSQL_DB_PASSWORD,
            port: MSSQL_DB_PORT,
            options: {
                encrypt: true,
                trustServerCertificate: true,
            },
        });

        pool = await sql.connect(adapterDBmssql);
        //await pool.request().query(query);
//INICIO TEMP CODE
        const resultSP = await pool.request().query(query);

        // Retornar los resultados en lugar de imprimirlos
        return resultSP.recordset;
//END TEMP CODE        
    } catch (err) {
        console.error('Error al ejecutar la consulta:', err);
        // Puedes lanzar el error para manejarlo fuera de esta función si es necesario
        throw err;
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

// PUERTOS DEV
const apiPORT = 3002;
const botPORT = 4000;


// Middleware para manejar solicitudes JSON
app.use(express.json());

// Ruta para manejar las solicitudes POST
//Consulta y devuelve el Edificio
app.post('/consultar', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'La consulta no fue proporcionada en el cuerpo de la solicitud.' });
        }

        // Obtener los resultados de la consulta
        const results = await executeQuery(query);

        // Filtrar y enviar solo la parte específica que contiene el nombre del campo "Edificio"
        const edificioResults = results.map(result => result.Edificio);

        // Enviar los resultados filtrados al cliente
        res.status(200).json({ message: 'Consulta ejecutada correctamente.', edificioResults });
    } catch (err) {
        console.error('Error en la ruta /consultar:', err);
        res.status(500).json({ error: 'Error en la consulta.' });
    }
});


// Ruta para manejar las solicitudes POST
//Consulta y devuelve el Territorio
app.post('/consultar2', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'La consulta no fue proporcionada en el cuerpo de la solicitud.' });
        }

        // Obtener los resultados de la consulta
        const results = await executeQuery(query);

        // Filtrar y enviar solo la parte específica que contiene el nombre del campo "Territorio"
        const territorioResults = results.map(result => result.Territorio);

        // Enviar los resultados filtrados al cliente
        res.status(200).json({ message: 'Consulta ejecutada correctamente.', territorioResults});
    } catch (err) {
        console.error('Error en la ruta /consultar:', err);
        res.status(500).json({ error: 'Error en la consulta.' });
    }
});


// Ruta para manejar las solicitudes POST
//Consulta y devuelve la Respuesta, es decir, los timbres en forma horizontal
app.post('/consultar3', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'La consulta no fue proporcionada en el cuerpo de la solicitud.' });
        }

        // Obtener los resultados de la consulta
        const results = await executeQuery(query);

        // Filtrar y enviar solo la parte específica que contiene el nombre del campo "Respuesta"
        const TimbresResults = results.map(result => result.Respuesta);

        // Enviar los resultados filtrados al cliente
        res.status(200).json({ message: 'Consulta ejecutada correctamente.', results});
    } catch (err) {
        console.error('Error en la ruta /consultar3:', err);
        res.status(500).json({ error: 'Error en la consulta.' });
    }
});


// Ruta para manejar las solicitudes POST
//Consulta y devuelve las Salidas en Formato Texto
app.post('/consultar4', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'La consulta no fue proporcionada en el cuerpo de la solicitud.' });
        }

        // Obtener los resultados de la consulta
        const results = await executeQuery(query);

        // Filtrar y enviar solo la parte específica que contiene el nombre del campo "Texto"
        const SalidasTextoResults = results.map(result => result.Texto);

        // Enviar los resultados filtrados al cliente
        res.status(200).json({ message: 'Consulta ejecutada correctamente.', SalidasTextoResults});
    } catch (err) {
        console.error('Error en la ruta /consultar4:', err);
        res.status(500).json({ error: 'Error en la consulta.' });
    }
});


// Ruta para manejar las solicitudes POST
//Consulta y devuelve el Telefono
app.post('/consultar5', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'La consulta no fue proporcionada en el cuerpo de la solicitud.' });
        }

        // Obtener los resultados de la consulta
        const results = await executeQuery(query);

        // Filtrar y enviar solo la parte específica que contiene el nombre del campo "Telefono"
        const TelefonoResults = results.map(result => result.TelefonoAsignado);

        // Enviar los resultados filtrados al cliente
        res.status(200).json({ message: 'Consulta ejecutada correctamente.', TelefonoResults });
    } catch (err) {
        console.error('Error en la ruta /consultar5:', err);
        res.status(500).json({ error: 'Error en la consulta.' });
    }
});

//Guarda la respuesta de la llamada telefónica
app.post('/consultar6', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'La consulta no fue proporcionada en el cuerpo de la solicitud.' });
        }

        // Obtener los resultados de la consulta
        const results = await executeQuery(query);

        // Filtrar y enviar solo la parte específica que contiene el nombre del campo "Telefono"
        const TelefonoRespuestaResults = results.map(result => result.Respuesta);

        // Enviar los resultados filtrados al cliente
        res.status(200).json({ message: 'Consulta ejecutada correctamente.', TelefonoRespuestaResults });
    } catch (err) {
        console.error('Error en la ruta /consultar6:', err);
        res.status(500).json({ error: 'Error en la consulta.' });
    }
});

// Iniciar el servidor de la API
app.listen(apiPORT, () => {
    console.log(`API escuchando en el puerto ${apiPORT}`);
});


//INICIA EL STORE PROCEDURE

app.post('/inicia_sp', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'La consulta no fue proporcionada en el cuerpo de la solicitud.' });
        }

        
        await executeSp(query);

       
        // Enviar los resultados filtrados al cliente
        res.status(200).json({ message: 'Consulta ejecutada correctamente.'});
    } catch (err) {
        console.error('Error en la ruta /inicia_sp:', err);
        res.status(500).json({ error: 'Error en la consulta.' });
    }
});


async function consultarAPI(query) {
    try {
        const apiUrl = 'http://localhost:3002/consultar'; // Reemplaza 'tuPuerto' con el puerto real de tu API
        const response = await axios.post(apiUrl, { query });

        // Verificar la respuesta de la API
        if (response.status === 200) {
            console.log('Consulta ejecutada correctamente:', response.data);
            // Puedes hacer algo con la respuesta aquí
        } else {
            console.error('Error en la consulta:', response.data);
            // Manejar el error según tus necesidades
        }
    } catch (error) {
        console.error('Error en la solicitud POST:', error.message);
        // Manejar el error según tus necesidades
    }
}


shared={}

// DEFINICION DE LA CONVERSACION

const flowPredicar = addKeyword(['2', 'Predicar', 'Predi'])
.addAnswer(['¿En qué territorio se encuentra?'],
        { capture: true, delay: 1500 },
        async (ctx, {state, flowDynamic, provider,endFlow,fallBack }) => {
        const territorio = ctx.body
        shared[ctx.from] = { territorio, number: ctx.from }

        const toExecuteSpData = {
            "query": `EXEC [dbo].[sp_asignacion_timbres] @NroTerritorio = '${territorio}'`
          }

        urlToSp = 'http://localhost:3002/inicia_sp';
        const responseSp = await fetch(urlToSp, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(toExecuteSpData),
        });
        if (responseSp.status === 200) {
            console.log('Se realizo la ejecucion a SP correctamente')
        const requestData = {
            "query": `SELECT * FROM dbo.Territorios where id_territorio = '${territorio}'`
        }
        

        url = 'http://localhost:3002/consultar2';
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
        });

        // Verifica la respuesta del servidor
        if (response.status === 200) {
                                console.log('La solicitud POST fue exitosa');
                                const responseBody = await response.json();  // Parsea la respuesta JSON

                                // Formatea el mensaje con los resultados específicos
                                const territorioResults = responseBody.territorioResults;
                                const formattedMessage = `El territorio *${territorio}* tiene ubicación entre las calles ${territorioResults.join(', ')}`;

                                // Envía el mensaje formateado a través de flowDynamic
                                //await flowDynamic(formattedMessage);
                                const requestData2 = {
                                    "query": "SELECT DISTINCT Edificio FROM dbo.Temp_Table_for_sp_asignacion_timbres"
                                }
                        
                                url2 = 'http://localhost:3002/consultar';
                                const response2 = await fetch(url2, {
                                    method: 'POST',
                                    headers: {
                                        'Accept': 'application/json',
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify(requestData2),
                                });
                        
                                // Verifica la respuesta del servidor
                                if (response2.status === 200) {
                                    console.log('La solicitud POST fue exitosa');
                                    const responseBody2 = await response2.json();  // Parsea la respuesta JSON
                                    console.log(responseBody2)
                                    //Formatea el mensaje con los resultados específicos
                                    const edificioResults2 = responseBody2.edificioResults;
                                    
                                    //Condicional
                                    if (edificioResults2 && edificioResults2.length > 0) {
                                        formattedMessage2 = `La dirección del edificio asignado es *${edificioResults2.join(', ')}* y los timbres son los siguientes:`;
                                    } else {
                                        formattedMessage2 = `Edificio no encontrado. Se han completado todos los edificios del territorio *${territorio}*.`;
                                    }                                    
                                    
                                    // Envía el mensaje formateado a través de flowDynamic
                                    await flowDynamic(formattedMessage2);

                                    //consulta timbres a tocar
                                    const requestData3 = {
                                        "query": "SELECT Respuesta  FROM dbo.Temp_Table_Respuestas ttr"
                                    }
                            
                                    url3 = 'http://localhost:3002/consultar3';
                                    const response3 = await fetch(url3, {
                                        method: 'POST',
                                        headers: {
                                            'Accept': 'application/json',
                                            'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify(requestData3),
                                    });
                            
                                    // Verifica la respuesta del servidor
                                    if (response3.status === 200) {
                                        console.log('La solicitud POST fue exitosa timbres');
                                        const responseBody3 = await response3.json();  // Parsea la respuesta JSON
                                        if (responseBody3.results && responseBody3.results.length > 0 && responseBody3.results[0].Respuesta) {
                                            const timbreResults = responseBody3.results[0].Respuesta;
                                            const formattedMessage3 = `${timbreResults}`;
                                            // Envía el mensaje formateado a través de flowDynamic
                                            await flowDynamic(formattedMessage3);
                                        } else {
                                            // Manejo del caso en que no hay resultados o no se encuentra Respuesta
                                            console.log('No hay timbres por asignar.');
                                        }

                                } else {
                                    // Manejo de errores aquí...
                                }
        } else {
            // Manejo de errores aquí...
        }

     }}})

const flowMapa = addKeyword(['3', 'mapa'])
                    .addAnswer('Este es el mapa de la Congregación Congreso. Si lo desea, también puede ver la versión del mismo en Google Maps con el siguiente link https://www.google.com/maps/d/edit?mid=1O4xOUCbtA6GConLCFJp2EyBdZdAHTOU&usp=sharing',
                                {
                                    media:'https://i.postimg.cc/s2x2VMKx/Mapa-Congregaci-n-Congreso.jpg'
                                }
                            )
                    .addAnswer(
                        [
                            'Para volver al Menú Principal escribí *Menu*.'
                            ,
                        ]
                    )
const flowSalidas = addKeyword(['1', 'imagen', 'documentación'])
                    .addAnswer('Éstas son las salidas de predicación para ésta semana. ',
                                {
                                    media:'https://i.postimg.cc/MZNfN3R7/Salidas.jpg'
                                }
                            )
                    .addAnswer(
                        [
                            'Para volver al Menú Principal escribí *Menu*.'
                            ,
                        ]
                    )

const flowSalidasTexto = addKeyword(['4', 'Aldo', 'accesibilidad'])
.addAnswer(['Éstas son las salidas de predicación para ésta semana en formato texto.'],
                            { capture: false, delay: 1500 }, async (ctx, {state, flowDynamic, provider,endFlow,fallBack }) => {
                                
                            const requestData4 = {
                                "query": "SELECT * FROM dbo.Salidas_Texto"
                            }
                    
                            url4 = 'http://localhost:3002/consultar4';
                            const response4 = await fetch(url4, {
                                method: 'POST',
                                headers: {
                                    'Accept': 'application/json',
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(requestData4),
                            });
                    
                            // Verifica la respuesta del servidor
        if (response4.status === 200) {
                            console.log('La solicitud POST fue exitosa');
                            const responseBody4 = await response4.json();  // Parsea la respuesta JSON

                            // Formatea el mensaje con los resultados específicos
                            const SalidasTextoResults = responseBody4.SalidasTextoResults;
                            const formattedMessage4 = `${SalidasTextoResults.join(', ')}`;

                            // Envía el mensaje formateado a través de flowDynamic
                            await flowDynamic(formattedMessage4);
                            }
                            else {
            // Manejo de errores aquí...
            console.log('La solicitud POST falló');
        }
                            })
                               

const flowPredicarTelefono22 = addKeyword(['Ok'])
    .addAnswer(
                [
                    '¿Cuál fue la respuesta?',
                    '👉 *1* contestó',
                    '👉 *2* no contestó',
                    '👉 *3* no corresponde a un abonado en servicio'
                ],
                { capture: true, delay: 1500 },
                async (ctx, {state, flowDynamic, provider,endFlow,fallBack }) => {
                const requestData6 = {
                                    "query": `EXEC [dbo].[sp_telefonos_guardar_respuesta] @Solicitante = '${ctx.from}', @CodigoRespuesta = ${ctx.body}`
                                    }
                    
                url6 = 'http://localhost:3002/consultar6';
                const response6 = await fetch(url6, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestData6),
                    }
                );
                    
                            // Verifica la respuesta del servidor
                            if (response6.status === 200) {
                                                console.log('La solicitud POST fue exitosa');
                                                const responseBody6 = await response6.json();  // Parsea la respuesta JSON

                                                // Formatea el mensaje con los resultados específicos
                                                const TelefonoRespuestaResults = responseBody6.TelefonoRespuestaResults;
                                                const formattedMessage6 = `${TelefonoRespuestaResults.join(', ')}`;

                                                // Envía el mensaje formateado a través de flowDynamic
                                                await flowDynamic(formattedMessage6);
                                                console.log(formattedMessage6);
                                                }
                                                else {
                                // Manejo de errores aquí...
                                console.log('La solicitud POST falló');
                            }
                            }
                )

const flowPredicarTelefono21 =  addKeyword(['Ok'])
.addAnswer('¿Cuál fué la respuesta?')
.addAnswer(
    ['*Ok* para guardar la respuesta'],
    { capture: false },
    (ctx) => {
        console.log(ctx)
    },
    []
) 

const flowPredicarTelefono = addKeyword(['5'])
        .addAnswer(['Este es el número asignado. Escribí *OK* para guardar la respuesta.'],
            { capture: false, delay: 1500 }, 
            async (ctx, {state, flowDynamic, provider,endFlow,fallBack }) => {
            const requestData5 = {
                                "query": `EXEC [dbo].[sp_telefonos_asignacion] @Solicitante = '${ctx.from}', @TelefonoAsignado = NULL`                
                                }
    
            url5 = 'http://localhost:3002/consultar5';
            const response5 = await fetch(url5, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData5),
            });
                    
        // Verifica la respuesta del servidor
        if (response5.status === 200) {
                            console.log('La solicitud POST fue exitosa');
                            const responseBody5 = await response5.json();  // Parsea la respuesta JSON

                            // Formatea el mensaje con los resultados específicos
                            const TelefonoResults = responseBody5.TelefonoResults;
                            const formattedMessage5 = `${TelefonoResults.join(', ')}`;

                            // Envía el mensaje formateado a través de flowDynamic
                            await flowDynamic(formattedMessage5);
                            console.log(formattedMessage5);
                            }
                            else {
            // Manejo de errores aquí...
            console.log('La solicitud POST falló');
        }
                            }
            ,
            [flowPredicarTelefono22]
        )


const flowPrincipal =addKeyword(EVENTS.WELCOME).addAction( async (ctx, { state, flowDynamic, provider, fallBack,endFlow }) => {
    const labnombre = ctx.body
    const number = ctx.from
    await delay(1500);
    
    // Agregar la respuesta al objeto compartido del usuario
    if (blacklist.includes(number)) {
        // El número está en la lista negra, puedes decidir no contestar o mostrar un mensaje personalizado
        console.log(`El número ${number} esta en lista blanca. Se contestará. En flujo 1`);
        
    }else{
        endFlow()

    }})

    .addAnswer(
        [
            '¡Buenos días!',
            '*1* - Enviar puntos de encuentro 📍',
            '*2* - Estoy en la predicación',
            '*3* - Enviar mapa 🗺️',
            '*4* - Accesibilidad - enviar las salidas en formato texto (*BETA!*)',
            '*5* - Predicación Telefónica ☎️'
            ,
        ],
        null,
        null,
        [flowSalidas,flowPredicar,flowMapa,flowSalidasTexto,flowPredicarTelefono,flowPredicarTelefono21,flowPredicarTelefono22]
    )


    const main = async () => {
        const adapterDB = new MockAdapter()
        const adapterFlow = createFlow([flowPrincipal])
        const adapterProvider = createProvider(BaileysProvider)
    
        createBot({
            flow: adapterFlow,
            provider: adapterProvider,
            database: adapterDB,
        })
    
    
        QRPortalWeb()
        app.post('/send-message-bot', async (req, res) => {
            try {
                const { message, phone } = req.body;
    
                if (!message || !phone) {
                    return res.status(400).send({ error: 'Mensaje y número de teléfono son obligatorios en el cuerpo.' });
                }
    
                const formattedPhone = `${phone}@c.us`;
    
                await adapterProvider.sendText(formattedPhone, message);
    
                res.send({ data: 'Mensaje enviado correctamente.' });
            } catch (error) {
                console.error('Error al enviar el mensaje:', error);
                res.status(500).send({ error: 'Error al enviar el mensaje.' });
            }
        });
    
    
        const PORT = 3501;
        app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
    
        
    }
    
    main()
