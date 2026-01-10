import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';

export const authOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                username: { label: 'Username', type: 'text' },
                password: { label: 'Password', type: 'password' }
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) {
                    return null;
                }

                try {
                    const db = getDb();
                    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(credentials.username);

                    if (!user) {
                        return null;
                    }

                    const isValid = bcrypt.compareSync(credentials.password, user.password_hash);

                    if (!isValid) {
                        return null;
                    }

                    return {
                        id: user.id.toString(),
                        name: user.username
                    };
                } catch (error) {
                    console.error('Auth error:', error);
                    return null;
                }
            }
        })
    ],
    pages: {
        signIn: '/login'
    },
    session: {
        strategy: 'jwt',
        maxAge: 24 * 60 * 60 // 24 hours
    },
    secret: process.env.AUTH_SECRET || 'service-parts-default-secret-change-me'
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
