const admin = require('firebase-admin');
// const db = admin.firestore();

/**
 * Service to manage user watchlists
 * In a real app, this interacts with Firestore.
 * For simulation/dev, we can mock it or use it if Firebase is set up.
 */
class WatchlistService {
    constructor(db) {
        this.db = db; // Inject DB instance
    }

    // Helper for simulation to pretend we have data
    async getMockWatchlist(userId) {
        return [
            { symbol: 'AAPL', assetType: 'us-stock', mode: 'technical' },
            { symbol: 'BTC', assetType: 'crypto', mode: 'technical' },
            { symbol: 'TSLA', assetType: 'us-stock', mode: 'technical' },
            { symbol: 'PTT', assetType: 'thai-stock', mode: 'price', targetPrice: 32, condition: 'below' },
            { symbol: 'KBANK', assetType: 'thai-stock', mode: 'both' }
        ];
    }

    async getWatchlist(userId) {
        if (!this.db) {
            return this.getMockWatchlist(userId);
        }

        try {
            const snapshot = await this.db.collection('users').doc(userId).collection('watchlist').where('active', '==', true).get();
            if (snapshot.empty) return [];
            return snapshot.docs.map(doc => doc.data());
        } catch (e) {
            console.warn("Firestore not connected or empty, returning mock data for dev.");
            return this.getMockWatchlist(userId);
        }
    }

    async addToWatchlist(userId, item) {
        if (!this.db) return { success: true, message: 'Simulated add' };

        await this.db.collection('users').doc(userId).collection('watchlist').add({
            ...item,
            active: true,
            addedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    }
}

module.exports = WatchlistService;
