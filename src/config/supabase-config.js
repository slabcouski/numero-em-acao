// Configuração do Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.43.4/+esm';

const SUPABASE_URL = 'https://ccpawqpdauhjjywasglt.supabase.co'; // Substitua pela sua URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjcGF3cXBkYXVoamp5d2FzZ2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MDk4OTYsImV4cCI6MjA4MzM4NTg5Nn0.ZULpg2xkK-Ejc99aOwBFuulR-6e1ZbMz0bEkgBXTFf8'; // Substitua pela sua chave

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
