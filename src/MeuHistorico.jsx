import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function MeuHistorico({ funcionariaLogadaId }) {
  return (
    <div className="panel large">
      <h2>Meu Histórico de Atividades</h2>
      <p>Em breve: aqui aparecerá o histórico completo das suas tarefas concluídas.</p>
    </div>
  );
} 