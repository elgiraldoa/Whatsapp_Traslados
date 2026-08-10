require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeInMemoryStore, jidDecode, Browsers, fetchLatestWaWebVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const axios = require('axios');

// CONFIGURACIÓN DE PASOS
const STEPS = [
    { key: 'proyectoDestino', label: 'Proyecto Destino', question: '📍 *Proyecto Destino:*' },
    { key: 'proyectoOrigen', label: 'Proyecto Origen', question: '🏢 *Proyecto Origen:*' },
    { key: 'material', label: 'Material', question: '📦 *Material (Nombre):*' },
    { key: 'cantidad', label: 'Cantidad', question: '🔢 *Cantidad:*' },
    { key: 'motivo', label: 'Motivo', question: '📝 *Motivo:*' },
    { key: 'urgencia', label: 'Urgencia', question: '⚠️ *Urgencia (Alta/Media/Baja):*' },
    { key: 'fechaRequerida', label: 'Fecha Requerida', question: '📅 *Fecha Requerida:*' },
    { key: 'responsable', label: 'Responsable', question: '👤 *Responsable:*' }
];

const sessions = new Map();

async function startBot() {
    // Definimos sock fuera para poder referenciarlo si es necesario
    let sock;

    async function connectToWhatsApp() {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        const { version, isLatest } = await fetchLatestWaWebVersion().catch(() => ({ version: [2, 3000, 1044839451], isLatest: false }));
        console.log(`📡 Usando WhatsApp Web v${version.join('.')}, isLatest: ${isLatest}`);

        sock = makeWASocket({
            version,
            printQRInTerminal: true,
            auth: state,
            logger: pino({ level: 'silent' }),
            browser: ['Material Bot', 'Chrome', '1.0.0']
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('📲 Escanea este QR con WhatsApp:\n');
                const qrcode = require('qrcode-terminal');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                console.log('❌ Conexión cerrada. Razón:', reason);

                const shouldReconnect = reason !== DisconnectReason.loggedOut;

                if (shouldReconnect) {
                    console.log('🔄 Reconectando en 5 segundos...');
                    setTimeout(connectToWhatsApp, 5000); // Pequeña espera para evitar bucles infinitos agresivos
                }
            } else if (connection === 'open') {
                console.log('✅ Bot conectado correctamente (Baileys)');
            }
        });

        // Mover el resto de los listeners aquí (messages.upsert)
        setupMessageListener(sock);
    }

    await connectToWhatsApp();
}

function setupMessageListener(sock) {
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();

        console.log(`Mensaje de ${senderJid} en ${from}: ${body}`);

        // Filtrar grupo específico
        const targetGroup = process.env.GROUP_ID;
        if (targetGroup && isGroup && from !== targetGroup) return;

        // INICIAR FLUJO
        if (body.toLowerCase() === '!traslado') {
            if (!isGroup) {
                await sock.sendMessage(from, { text: '⚠️ Debes iniciar la solicitud desde el grupo.' });
                return;
            }

            if (sessions.has(senderJid)) {
                await sock.sendMessage(senderJid, { text: '⚠️ Ya tienes una solicitud en proceso.' });
                return;
            }

            sessions.set(senderJid, {
                step: 0,
                data: { fechaSolicitud: new Date().toLocaleDateString('es-ES') },
                groupId: from
            });

            await sock.sendMessage(from, {
                text: `📩 @${senderJid.split('@')[0]} revisa tu chat privado para completar la solicitud.`,
                mentions: [senderJid]
            });

            await sock.sendMessage(senderJid, {
                text: `🚀 *NUEVA SOLICITUD DE TRASLADO*\n\nComencemos.\n\n${STEPS[0].question}`
            });
            return;
        }

        // CONTINUAR FLUJO PRIVADO
        if (sessions.has(senderJid)) {
            if (isGroup) return; // Solo privado

            const session = sessions.get(senderJid);

            if (session.step < STEPS.length) {
                const currentStep = STEPS[session.step];

                // Validación Urgencia
                if (currentStep.key === 'urgencia') {
                    const valid = ['alta', 'media', 'baja'].includes(body.toLowerCase());
                    if (!valid) {
                        await sock.sendMessage(from, { text: '⚠️ Urgencia inválida. Usa: Alta, Media o Baja.' });
                        return;
                    }
                }

                session.data[currentStep.key] = body;
                session.step++;

                if (session.step < STEPS.length) {
                    await sock.sendMessage(from, {
                        text: `📝 *Paso ${session.step + 1}/${STEPS.length}*\n\n${STEPS[session.step].question}`
                    });
                } else {
                    let summary = `✅ *RESUMEN DE SOLICITUD*\n\n`;
                    STEPS.forEach(step => {
                        summary += `• *${step.label}:* ${session.data[step.key]}\n`;
                    });
                    summary += `\n📅 *Fecha:** ${session.data.fechaSolicitud}`;
                    summary += `\n\nResponde:\n✅ *CONFIRMAR*\n❌ *CANCELAR*`;
                    await sock.sendMessage(from, { text: summary });
                }
                return;
            }

            // Confirmación
            if (body.toUpperCase() === 'CONFIRMAR') {
                await sendToGoogleSheets(session.data, senderJid);

                let finalPost = `📢 *NUEVA SOLICITUD DE TRASLADO*\n\n`;
                STEPS.forEach(step => {
                    finalPost += `• *${step.label}:* ${session.data[step.key]}\n`;
                });
                finalPost += `\n👤 *Solicitado por:* @${senderJid.split('@')[0]}`;

                await sock.sendMessage(session.groupId, {
                    text: finalPost,
                    mentions: [senderJid]
                });
                await sock.sendMessage(from, { text: '✅ Solicitud enviada correctamente.' });
                sessions.delete(senderJid);
            } else if (body.toUpperCase() === 'CANCELAR') {
                await sock.sendMessage(from, { text: '❌ Solicitud cancelada.' });
                sessions.delete(senderJid);
            } else {
                await sock.sendMessage(from, { text: '⚠️ Responde CONFIRMAR o CANCELAR.' });
            }
        }
    });
}

async function sendToGoogleSheets(data, userPhone) {
    const url = process.env.GOOGLE_APPS_SCRIPT_URL;
    if (!url) return;
    try {
        await axios.post(url, { ...data, usuarioWhatsApp: userPhone });
        console.log('✅ Datos enviados a Google Sheets');
    } catch (error) {
        console.error('❌ Error Sheets:', error.message);
    }
}

startBot();