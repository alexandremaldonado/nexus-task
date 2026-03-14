const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();

const pool = new Pool({
  connectionString: 'postgres://postgres:UPc5N5qhQi9MyRKpCzBMBzRZu11Qdo7FoujsG2xlLlf15QrPC2X7fdah1IK2ovX7@187.77.53.190:5432/postgres?sslmode=disable',
  connectionTimeoutMillis: 5000
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 1. Dashboard (Agora traz o tempo total do banco)
app.get('/dashboard/:orgId', async (req, res) => {
    const { orgId } = req.params;
    try {
        const orgRes = await pool.query('SELECT name FROM controle_tarefas.organizations WHERE id = $1', [orgId]);
        if (orgRes.rows.length === 0) return res.status(404).send('Orga não encontrada');

        const tasksRes = await pool.query(`
            SELECT t.*, 
            COALESCE(SUM(EXTRACT(EPOCH FROM (te.end_time - te.start_time))), 0)::INTEGER as total_seconds_tracked
            FROM controle_tarefas.tasks t
            LEFT JOIN controle_tarefas.time_entries te ON t.id = te.task_id
            WHERE t.org_id = $1 AND t.status != 'done'
            GROUP BY t.id
            ORDER BY t.created_at DESC
        `, [orgId]);

        res.render('dashboard', { tasks: tasksRes.rows, orgName: orgRes.rows[0].name, orgId: orgId });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 2. A SUA API TIMER (Mantida e protegida)
app.post('/api/timer', async (req, res) => {
    const { taskId, userId, action } = req.body;
    try {
        if (action === 'start') {
            await pool.query('INSERT INTO controle_tarefas.time_entries (task_id, user_id, start_time) VALUES ($1, $2, NOW())', [taskId, userId]);
        } else {
            await pool.query('UPDATE controle_tarefas.time_entries SET end_time = NOW() WHERE task_id = $1 AND end_time IS NULL', [taskId]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Rota para Concluir Tarefa
app.post('/api/tasks/:taskId/done', async (req, res) => {
    const { taskId } = req.params;
    try {
        await pool.query('UPDATE controle_tarefas.time_entries SET end_time = NOW() WHERE task_id = $1 AND end_time IS NULL', [taskId]);
        await pool.query("UPDATE controle_tarefas.tasks SET status = 'done' WHERE id = $1", [taskId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => console.log(`📡 Servidor rodando na porta ${PORT}`));