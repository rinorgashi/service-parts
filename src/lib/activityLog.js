import { getDb } from './db';

/**
 * Log an activity to the activity_logs table
 * @param {Object} params
 * @param {string} params.username - Username of the user performing the action
 * @param {string} params.action - Action type: 'create', 'update', 'delete'
 * @param {string} params.entityType - Type of entity: 'part', 'customer', 'sale', 'purchase', 'service', 'user'
 * @param {number} params.entityId - ID of the entity
 * @param {string} params.entityName - Name/description of the entity for display
 * @param {string} [params.details] - Additional details about the action
 */
export function logActivity({ username, action, entityType, entityId, entityName, details }) {
    try {
        const db = getDb();

        // Get user ID from username
        const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        const userId = user?.id || null;

        db.prepare(`
            INSERT INTO activity_logs (user_id, username, action, entity_type, entity_id, entity_name, details)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, username, action, entityType, entityId, entityName, details || null);
    } catch (error) {
        console.error('Error logging activity:', error);
        // Don't throw - logging should not break the main operation
    }
}

export default logActivity;
