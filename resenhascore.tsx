import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Trophy,
  Users,
  Play,
  Download,
  Upload,
  Plus,
  Search,
  Award,
  Target,
  Zap,
  Edit3,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Save,
  Shield,
  Flame,
  BarChart3,
  FileJson,
  X,
  UserPlus,
  Sparkles,
  Calendar
} from 'lucide-react';

// ============================================================================
// BANCO DE DADOS INICIAL (Simulando o arquivo jogadores.json)
// ============================================================================
const INITIAL_JOGADORES_JSON = [
  {
    id: "j1",
    nome: "Carlos 'Imperador' Silva",
    posicao: "Atacante",
    gols: 24,
    assistencias: 9,
    vitorias: 14,
    partidas: 18,
    notaMedia: 8.9
  },
  {
    id: "j2",
    nome: "Lucas 'Maestro' Mendes",
    posicao: "Meia",
    gols: 12,
    assistencias: 21,
    vitorias: 15,
    partidas: 19,
    notaMedia: 9.1
  },
  {
    id: "j3",
    nome: "Rafael 'Muralha' Costa",
    posicao: "Goleiro",
    gols: 1,
    assistencias: 3,
    vitorias: 13,
    partidas: 17,
    notaMedia: 8.6
  },
  {
    id: "j4",
    nome: "Bruno 'Xerife' Alves",
    posicao: "Zagueiro",
    gols: 5,
    assistencias: 4,
    vitorias: 12,
    partidas: 18,
    notaMedia: 8.2
  },
  {
    id: "j5",
    nome: "Diego 'Foguete' Santos",
    posicao: "Lateral",
    gols: 9,
    assistencias: 14,
    vitorias: 11,
    partidas: 16,
    notaMedia: 8.4
  },
  {
    id: "j6",
    nome: "Thiago 'Tanque' Oliveira",
    posicao: "Atacante",
    gols: 19,
    assistencias: 6,
    vitorias: 10,
    partidas: 15,
    notaMedia: 8.3
  },
  {
    id: "j7",
    nome: "Matheus 'Motorzinho' Lima",
    posicao: "Meia",
    gols: 8,
    assistencias: 12,
    vitorias: 11,
    partidas: 17,
    notaMedia: 8.0
  },
  {
    id: "j8",
    nome: "Gabriel 'Parede' Rocha",
    posicao: "Zagueiro",
    gols: 3,
    assistencias: 2,
    vitorias: 9,
    partidas: 14,
    notaMedia: 7.8
  }
];

const POSICOES = ["Todos", "Goleiro", "Zagueiro", "Lateral", "Meia", "Atacante"];

const STORAGE_KEY = "resenhascore_jogadores_v1";
const HISTORY_KEY = "resenhascore_partidas_v1";
const PLAYERS_API = "/.netlify/functions/players";

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function App() {
  // Estado principal dos jogadores (carregado do LocalStorage ou JSON inicial)
  const [jogadores, setJogadores] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Erro ao ler LocalStorage:", e);
    }
    return INITIAL_JOGADORES_JSON;
  });

  // Histórico de partidas encerradas
  const [historicoPartidas, setHistoricoPartidas] = useState(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Navegação e UI
  const [abaAtiva, setAbaAtiva] = useState("dashboard"); // 'dashboard' | 'jogadores' | 'resenha' | 'json'
  const [toast, setToast] = useState(null);
  const [salvandoJogador, setSalvandoJogador] = useState(false);
  const [bancoRemotoAtivo, setBancoRemotoAtivo] = useState(false);
  const fileInputRef = useRef(null);
  const elencoSincronizado = useRef(false);
  const sincronizacaoTimer = useRef(null);

  // Filtros da aba Jogadores
  const [busca, setBusca] = useState("");
  const [filtroPosicao, setFiltroPosicao] = useState("Todos");
  const [ordenacao, setOrdenacao] = useState("notaMedia"); // 'notaMedia' | 'gols' | 'assistencias' | 'vitorias'

  // Modal de Cadastro / Edição de Jogador
  const [modalJogadorAberto, setModalJogadorAberto] = useState(false);
  const [jogadorEditando, setJogadorEditando] = useState(null);
  const [formJogador, setFormJogador] = useState({
    nome: "",
    posicao: "Meia",
    gols: 0,
    assistencias: 0,
    vitorias: 0,
    partidas: 0,
    notaMedia: 7.5
  });

  // Estado do Gerador / Placar de Partida ao Vivo (Resenha)
  const [timeAIds, setTimeAIds] = useState(["j1", "j2", "j3", "j4"]);
  const [timeBIds, setTimeBIds] = useState(["j5", "j6", "j7", "j8"]);
  const [nomeTimeA, setNomeTimeA] = useState("Time Verde Neon");
  const [nomeTimeB, setNomeTimeB] = useState("Time Preto Fosco");
  const [eventosPartida, setEventosPartida] = useState([]); // { id, time: 'A'|'B', autorId, assistenteId, minuto }
  const [autorGolId, setAutorGolId] = useState("");
  const [assistenteGolId, setAssistenteGolId] = useState("");
  const [timeGolSelecionado, setTimeGolSelecionado] = useState("A");
  const [confirmarResetAberto, setConfirmarResetAberto] = useState(false);

  // O elenco vem do banco da Netlify. O localStorage continua apenas como
  // cópia de segurança para abrir a interface durante o desenvolvimento local.
  useEffect(() => {
    let ativo = true;

    const carregarJogadores = async () => {
      try {
        const resposta = await fetch(PLAYERS_API, { headers: { Accept: "application/json" } });
        const tipo = resposta.headers.get("content-type") || "";
        if (!resposta.ok || !tipo.includes("application/json")) throw new Error("API indisponível");
        const dados = await resposta.json();
        if (ativo && Array.isArray(dados.players)) {
          setJogadores(dados.players);
          setBancoRemotoAtivo(true);
        }
      } catch (erro) {
        console.info("Banco remoto ainda não está disponível; usando dados locais.", erro);
      }
    };

    carregarJogadores();
    return () => { ativo = false; };
  }, []);

  // Salvar automaticamente no LocalStorage sempre que jogadores ou histórico mudarem
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jogadores));
    } catch (e) {
      console.error("Erro ao salvar jogadores:", e);
    }
  }, [jogadores]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(historicoPartidas));
    } catch (e) {
      console.error("Erro ao salvar histórico:", e);
    }
  }, [historicoPartidas]);

  // Helper para notificações visuais (sem alert)
  const mostrarNotificacao = (mensagem, tipo = "sucesso") => {
    setToast({ mensagem, tipo });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const chamarApiJogadores = async (method, { player, players, id } = {}) => {
    const url = id ? `${PLAYERS_API}?id=${encodeURIComponent(id)}` : PLAYERS_API;
    const body = player ? { player } : Array.isArray(players) ? { players } : undefined;
    const requisitar = async (senha) => {
      const headers = { Accept: "application/json" };
      if (body) headers["Content-Type"] = "application/json";
      if (senha) headers["x-admin-password"] = senha;
      return fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
    };

    let senha = sessionStorage.getItem("resenhascore_admin_password") || "";
    let resposta = await requisitar(senha);

    if (resposta.status === 401) {
      senha = window.prompt("Informe a senha de administrador para alterar o elenco:") || "";
      if (!senha) {
        const erro = new Error("Alteração cancelada: senha de administrador necessária.");
        erro.status = 401;
        throw erro;
      }
      sessionStorage.setItem("resenhascore_admin_password", senha);
      resposta = await requisitar(senha);
      if (resposta.status === 401) sessionStorage.removeItem("resenhascore_admin_password");
    }

    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      const erro = new Error(dados.error || "Não foi possível salvar no banco de dados.");
      erro.status = resposta.status;
      throw erro;
    }
    return dados;
  };

  // Alterações feitas pelo placar ao vivo, importação ou ajuste rápido também
  // são enviadas ao banco. A pequena espera agrupa vários cliques seguidos.
  useEffect(() => {
    if (!bancoRemotoAtivo) return undefined;
    if (!elencoSincronizado.current) {
      elencoSincronizado.current = true;
      return undefined;
    }

    window.clearTimeout(sincronizacaoTimer.current);
    sincronizacaoTimer.current = window.setTimeout(() => {
      chamarApiJogadores("PUT", { players: jogadores }).catch((erro) => {
        console.error("Não foi possível sincronizar o elenco.", erro);
      });
    }, 500);

    return () => window.clearTimeout(sincronizacaoTimer.current);
  }, [jogadores, bancoRemotoAtivo]);

  // ============================================================================
  // CÁLCULOS E RANKINGS (DASHBOARD)
  // ============================================================================
  const estatisticasGerais = useMemo(() => {
    const totalGols = jogadores.reduce((acc, j) => acc + (Number(j.gols) || 0), 0);
    const totalAssistencias = jogadores.reduce((acc, j) => acc + (Number(j.assistencias) || 0), 0);
    const totalPartidas = historicoPartidas.length > 0
      ? historicoPartidas.length + 19
      : Math.max(...jogadores.map((j) => Number(j.partidas) || 0), 0);

    const artilheiros = [...jogadores].sort((a, b) => b.gols - a.gols || b.assistencias - a.assistencias);
    const garcons = [...jogadores].sort((a, b) => b.assistencias - a.assistencias || b.gols - a.gols);
    const craques = [...jogadores].sort((a, b) => b.notaMedia - a.notaMedia || (b.gols + b.assistencias) - (a.gols + a.assistencias));

    return {
      totalJogadores: jogadores.length,
      totalGols,
      totalAssistencias,
      totalPartidas,
      artilheiros,
      garcons,
      craques,
      craqueDaGalera: craques[0] || null,
      artilheiroMor: artilheiros[0] || null,
      reiDasAssistencias: garcons[0] || null
    };
  }, [jogadores, historicoPartidas]);

  // Jogadores filtrados para a aba de Elenco
  const jogadoresFiltrados = useMemo(() => {
    return jogadores
      .filter((j) => {
        const matchNome = j.nome.toLowerCase().includes(busca.toLowerCase());
        const matchPos = filtroPosicao === "Todos" || j.posicao === filtroPosicao;
        return matchNome && matchPos;
      })
      .sort((a, b) => (Number(b[ordenacao]) || 0) - (Number(a[ordenacao]) || 0));
  }, [jogadores, busca, filtroPosicao, ordenacao]);

  // ============================================================================
  // IMPORTAÇÃO E EXPORTAÇÃO JSON
  // ============================================================================
  const exportarJSON = () => {
    const dataStr = JSON.stringify(jogadores, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "jogadores.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    mostrarNotificacao("Arquivo jogadores.json baixado com sucesso!");
  };

  const importarJSON = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!Array.isArray(parsed)) {
          throw new Error("O arquivo JSON precisa conter uma lista [ ... ] de jogadores.");
        }
        const sanitizados = parsed.map((item, idx) => ({
          id: item.id || `imp_${Date.now()}_${idx}`,
          nome: String(item.nome || `Jogador ${idx + 1}`),
          posicao: POSICOES.includes(item.posicao) && item.posicao !== "Todos" ? item.posicao : "Meia",
          gols: Number(item.gols) || 0,
          assistencias: Number(item.assistencias) || 0,
          vitorias: Number(item.vitorias) || 0,
          partidas: Number(item.partidas) || 0,
          notaMedia: Math.min(10, Math.max(0, Number(item.notaMedia) || 7.5))
        }));
        setJogadores(sanitizados);
        mostrarNotificacao(`${sanitizados.length} jogadores importados do JSON!`);
      } catch (err) {
        mostrarNotificacao("Arquivo JSON inválido. Verifique a estrutura.", "erro");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const restaurarBancoPadrao = () => {
    setJogadores(INITIAL_JOGADORES_JSON);
    setHistoricoPartidas([]);
    setConfirmarResetAberto(false);
    mostrarNotificacao("Banco JSON inicial restaurado!");
  };

  // ============================================================================
  // CRUD DE JOGADORES
  // ============================================================================
  const abrirNovoJogador = () => {
    setJogadorEditando(null);
    setFormJogador({
      nome: "",
      posicao: "Meia",
      gols: 0,
      assistencias: 0,
      vitorias: 0,
      partidas: 0,
      notaMedia: 7.5
    });
    setModalJogadorAberto(true);
  };

  const abrirEditarJogador = (jogador) => {
    setJogadorEditando(jogador);
    setFormJogador({ ...jogador });
    setModalJogadorAberto(true);
  };

  const salvarJogador = async (e) => {
    e.preventDefault();
    if (!formJogador.nome.trim()) {
      mostrarNotificacao("Informe o nome ou apelido do jogador.", "erro");
      return;
    }

    const dadosLimpos = {
      ...formJogador,
      nome: formJogador.nome.trim(),
      gols: Math.max(0, Number(formJogador.gols) || 0),
      assistencias: Math.max(0, Number(formJogador.assistencias) || 0),
      vitorias: Math.max(0, Number(formJogador.vitorias) || 0),
      partidas: Math.max(0, Number(formJogador.partidas) || 0),
      notaMedia: Math.min(10, Math.max(0, Number(formJogador.notaMedia) || 7.5))
    };

    setSalvandoJogador(true);
    try {
      const dados = await chamarApiJogadores(jogadorEditando ? "PUT" : "POST", {
        player: dadosLimpos,
        id: jogadorEditando?.id
      });
      const jogadorSalvo = dados.player;

      if (jogadorEditando) {
        setJogadores((prev) => prev.map((j) => (j.id === jogadorSalvo.id ? jogadorSalvo : j)));
        mostrarNotificacao(`Dados de ${jogadorSalvo.nome} atualizados!`);
      } else {
        setJogadores((prev) => [jogadorSalvo, ...prev]);
        mostrarNotificacao(`${jogadorSalvo.nome} entrou para a resenha!`);
      }
      setModalJogadorAberto(false);
    } catch (erro) {
      if (erro.status === 404) {
        mostrarNotificacao("Banco indisponível localmente. Use Netlify Dev ou publique o site.", "erro");
      } else {
        mostrarNotificacao(erro.message || "Não foi possível salvar o jogador.", "erro");
      }
    } finally {
      setSalvandoJogador(false);
    }
  };

  const excluirJogador = async (id, nome) => {
    if (!window.confirm(`Excluir ${nome} do elenco?`)) return;

    try {
      await chamarApiJogadores("DELETE", { id });
      setJogadores((prev) => prev.filter((j) => j.id !== id));
      setTimeAIds((prev) => prev.filter((item) => item !== id));
      setTimeBIds((prev) => prev.filter((item) => item !== id));
      mostrarNotificacao(`${nome} removido do elenco.`);
    } catch (erro) {
      mostrarNotificacao(erro.message || "Não foi possível excluir o jogador.", "erro");
    }
  };

  const ajusteRapidoStat = (id, campo, delta) => {
    setJogadores((prev) =>
      prev.map((j) => {
        if (j.id !== id) return j;
        const novoValor = Math.max(0, (Number(j[campo]) || 0) + delta);
        return { ...j, [campo]: novoValor };
      })
    );
  };

  // ============================================================================
  // LÓGICA DA PARTIDA AO VIVO (RESENHA)
  // ============================================================================
  const placarA = eventosPartida.filter((e) => e.time === "A").length;
  const placarB = eventosPartida.filter((e) => e.time === "B").length;

  const jogadoresTimeA = jogadores.filter((j) => timeAIds.includes(j.id));
  const jogadoresTimeB = jogadores.filter((j) => timeBIds.includes(j.id));
  const jogadoresSemTime = jogadores.filter(
    (j) => !timeAIds.includes(j.id) && !timeBIds.includes(j.id)
  );

  const sortearTimesEquilibrados = () => {
    if (jogadores.length < 2) {
      mostrarNotificacao("Cadastre pelo menos 2 jogadores para sortear.", "erro");
      return;
    }
    const ordenados = [...jogadores].sort((a, b) => b.notaMedia - a.notaMedia);
    const novoA = [];
    const novoB = [];
    ordenados.forEach((jog, idx) => {
      // Distribuição estilo "cobra" (1-A, 2-B, 3-B, 4-A...) para equilibrar notas
      if (idx % 4 === 0 || idx % 4 === 3) {
        novoA.push(jog.id);
      } else {
        novoB.push(jog.id);
      }
    });
    setTimeAIds(novoA);
    setTimeBIds(novoB);
    setEventosPartida([]);
    mostrarNotificacao("Times sorteados pelo equilíbrio de Nota Média!");
  };

  const alternarTimeJogador = (id, destino) => {
    setTimeAIds((prev) => prev.filter((x) => x !== id));
    setTimeBIds((prev) => prev.filter((x) => x !== id));
    if (destino === "A") setTimeAIds((prev) => [...prev, id]);
    if (destino === "B") setTimeBIds((prev) => [...prev, id]);
  };

  const registrarGolPartida = (e) => {
    e.preventDefault();
    if (!autorGolId) {
      mostrarNotificacao("Selecione quem marcou o gol!", "erro");
      return;
    }
    if (assistenteGolId && assistenteGolId === autorGolId) {
      mostrarNotificacao("O autor do gol não pode dar assistência para si mesmo.", "erro");
      return;
    }

    const novoEvento = {
      id: `ev_${Date.now()}`,
      time: timeGolSelecionado,
      autorId: autorGolId,
      assistenteId: assistenteGolId || null,
      horario: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    };

    setEventosPartida((prev) => [...prev, novoEvento]);
    setAutorGolId("");
    setAssistenteGolId("");
    mostrarNotificacao("GOOOOL registrado no placar!");
  };

  const removerEventoPartida = (eventoId) => {
    setEventosPartida((prev) => prev.filter((ev) => ev.id !== eventoId));
  };

  const encerrarESalvarPartida = () => {
    if (timeAIds.length === 0 && timeBIds.length === 0) {
      mostrarNotificacao("Escale os times antes de encerrar a partida.", "erro");
      return;
    }

    const vencedor = placarA > placarB ? "A" : placarB > placarA ? "B" : "EMPATE";

    // Contabilizar gols e assistências da partida por jogador
    const golsNaPartida = {};
    const assistsNaPartida = {};

    eventosPartida.forEach((ev) => {
      golsNaPartida[ev.autorId] = (golsNaPartida[ev.autorId] || 0) + 1;
      if (ev.assistenteId) {
        assistsNaPartida[ev.assistenteId] = (assistsNaPartida[ev.assistenteId] || 0) + 1;
      }
    });

    // Atualizar o banco JSON de jogadores
    setJogadores((prev) =>
      prev.map((j) => {
        const jogouA = timeAIds.includes(j.id);
        const jogouB = timeBIds.includes(j.id);
        if (!jogouA && !jogouB) return j;

        const golsFeitos = golsNaPartida[j.id] || 0;
        const assistsFeitas = assistsNaPartida[j.id] || 0;
        const venceu = (jogouA && vencedor === "A") || (jogouB && vencedor === "B");

        // Cálculo dinâmico de atualização da nota média
        const notaPartida = Math.min(
          10,
          7.0 + golsFeitos * 0.7 + assistsFeitas * 0.5 + (venceu ? 0.6 : 0)
        );
        const novasPartidas = (Number(j.partidas) || 0) + 1;
        const novaMedia = Number(
          (((Number(j.notaMedia) || 7.5) * (novasPartidas - 1) + notaPartida) / novasPartidas).toFixed(1)
        );

        return {
          ...j,
          gols: (Number(j.gols) || 0) + golsFeitos,
          assistencias: (Number(j.assistencias) || 0) + assistsFeitas,
          vitorias: (Number(j.vitorias) || 0) + (venceu ? 1 : 0),
          partidas: novasPartidas,
          notaMedia: novaMedia
        };
      })
    );

    // Salvar registro no histórico
    const resumoPartida = {
      id: `p_${Date.now()}`,
      data: new Date().toLocaleDateString("pt-BR"),
      timeA: nomeTimeA,
      timeB: nomeTimeB,
      placarA,
      placarB,
      totalEventos: eventosPartida.length
    };
    setHistoricoPartidas((prev) => [resumoPartida, ...prev]);
    setEventosPartida([]);
    mostrarNotificacao("Partida encerrada! Estatísticas salvas no JSON dos jogadores.");
  };

  // ============================================================================
  // RENDERIZAÇÃO
  // ============================================================================
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-400 selection:text-zinc-950 pb-20 md:pb-8">
      {/* NOTIFICAÇÃO TOAST */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md transition-all animate-bounce ${
            toast.tipo === "erro"
              ? "bg-red-950/90 border-red-500/50 text-red-200"
              : "bg-emerald-950/90 border-emerald-400/60 text-emerald-200"
          }`}
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toast.mensagem}</span>
        </div>
      )}

      {/* CABEÇALHO / NAVBAR */}
      <header className="sticky top-0 z-30 bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Trophy className="w-5 h-5 text-zinc-950 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                RESENHA<span className="text-emerald-400">SCORE</span>
              </h1>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                Gestão de Peladas & Estatísticas em JSON
              </p>
            </div>
          </div>

          {/* Navegação Desktop */}
          <nav className="hidden md:flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setAbaAtiva("dashboard")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                abaAtiva === "dashboard"
                  ? "bg-emerald-400 text-zinc-950 shadow-md shadow-emerald-400/20"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Painel Geral
            </button>
            <button
              onClick={() => setAbaAtiva("jogadores")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                abaAtiva === "jogadores"
                  ? "bg-emerald-400 text-zinc-950 shadow-md shadow-emerald-400/20"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
              }`}
            >
              <Users className="w-4 h-4" />
              Jogadores ({jogadores.length})
            </button>
            <button
              onClick={() => setAbaAtiva("resenha")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                abaAtiva === "resenha"
                  ? "bg-emerald-400 text-zinc-950 shadow-md shadow-emerald-400/20"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
              }`}
            >
              <Play className="w-4 h-4" />
              Placar ao Vivo
              {eventosPartida.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-xs bg-zinc-950 text-emerald-400 rounded-full">
                  {placarA}x{placarB}
                </span>
              )}
            </button>
            <button
              onClick={() => setAbaAtiva("json")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                abaAtiva === "json"
                  ? "bg-emerald-400 text-zinc-950 shadow-md shadow-emerald-400/20"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
              }`}
            >
              <FileJson className="w-4 h-4" />
              Banco JSON
            </button>
          </nav>

          {/* Ações Rápidas JSON */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".json,application/json"
              ref={fileInputRef}
              onChange={importarJSON}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Importar arquivo jogadores.json"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs sm:text-sm font-medium transition"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Importar</span>
            </button>
            <button
              onClick={exportarJSON}
              title="Baixar arquivo jogadores.json atualizado"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs sm:text-sm font-semibold transition"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar JSON</span>
            </button>
          </div>
        </div>
      </header>

      {/* NAVEGAÇÃO MOBILE INFERIOR */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 grid grid-cols-4 p-1.5">
        <button
          onClick={() => setAbaAtiva("dashboard")}
          className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[11px] font-medium ${
            abaAtiva === "dashboard" ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-400"
          }`}
        >
          <BarChart3 className="w-5 h-5 mb-0.5" />
          Painel
        </button>
        <button
          onClick={() => setAbaAtiva("jogadores")}
          className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[11px] font-medium ${
            abaAtiva === "jogadores" ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-400"
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          Elenco
        </button>
        <button
          onClick={() => setAbaAtiva("resenha")}
          className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[11px] font-medium relative ${
            abaAtiva === "resenha" ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-400"
          }`}
        >
          <Play className="w-5 h-5 mb-0.5" />
          Placar
        </button>
        <button
          onClick={() => setAbaAtiva("json")}
          className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[11px] font-medium ${
            abaAtiva === "json" ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-400"
          }`}
        >
          <FileJson className="w-5 h-5 mb-0.5" />
          JSON
        </button>
      </nav>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* ==================================================================== */}
        {/* ABA 1: DASHBOARD / PAINEL GERAL                                      */}
        {/* ==================================================================== */}
        {abaAtiva === "dashboard" && (
          <div className="space-y-6">
            {/* Banner Hero */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-emerald-950/60 border border-zinc-800 p-6 sm:p-8">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2 max-w-xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <Flame className="w-3.5 h-3.5" />
                    Temporada Oficial 2026
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    A resenha organizada, o placar atualizado.
                  </h2>
                  <p className="text-sm text-zinc-400">
                    Acompanhe artilharia, líderes de assistências e notas da galera. Todos os dados são salvos em JSON prontos para exportar.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setAbaAtiva("resenha")}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Iniciar Partida
                  </button>
                  <button
                    onClick={() => {
                      setAbaAtiva("jogadores");
                      abrirNovoJogador();
                    }}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-sm border border-zinc-700 transition"
                  >
                    <UserPlus className="w-4 h-4 text-emerald-400" />
                    Novo Jogador
                  </button>
                </div>
              </div>
            </div>

            {/* Cards de Resumo */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-zinc-900/70 border border-zinc-800/90 rounded-2xl p-5">
                <div className="flex items-center justify-between text-zinc-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Elenco Ativo</span>
                  <Users className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-3xl font-black text-white">{estatisticasGerais.totalJogadores}</p>
                <p className="text-xs text-zinc-500 mt-1">Atletas no JSON</p>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800/90 rounded-2xl p-5">
                <div className="flex items-center justify-between text-zinc-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Gols Marcados</span>
                  <Target className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-3xl font-black text-emerald-400">{estatisticasGerais.totalGols}</p>
                <p className="text-xs text-zinc-500 mt-1">Bolas na rede na temporada</p>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800/90 rounded-2xl p-5">
                <div className="flex items-center justify-between text-zinc-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Assistências</span>
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-3xl font-black text-white">{estatisticasGerais.totalAssistencias}</p>
                <p className="text-xs text-zinc-500 mt-1">Passes decisivos</p>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800/90 rounded-2xl p-5">
                <div className="flex items-center justify-between text-zinc-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Craque da Galera</span>
                  <Award className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-lg font-black text-white truncate">
                  {estatisticasGerais.craqueDaGalera?.nome || "-"}
                </p>
                <p className="text-xs text-emerald-400 font-semibold mt-1">
                  Nota {estatisticasGerais.craqueDaGalera?.notaMedia || "0.0"}
                </p>
              </div>
            </div>

            {/* 3 Colunas de Rankings */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Ranking Artilheiros */}
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Artilharia</h3>
                      <p className="text-xs text-zinc-400">Maiores goleadores</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 uppercase">Gols</span>
                </div>

                <div className="space-y-3 flex-1">
                  {estatisticasGerais.artilheiros.slice(0, 5).map((jog, index) => (
                    <div
                      key={jog.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                            index === 0
                              ? "bg-emerald-400 text-zinc-950"
                              : index === 1
                              ? "bg-zinc-700 text-white"
                              : index === 2
                              ? "bg-amber-700/60 text-amber-200"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {index + 1}
                        </span>
                        <div className="truncate">
                          <p className="text-sm font-semibold text-white truncate">{jog.nome}</p>
                          <p className="text-[11px] text-zinc-500">{jog.posicao}</p>
                        </div>
                      </div>
                      <span className="text-base font-black text-emerald-400 pl-2">
                        {jog.gols}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ranking Assistências */}
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Garçons</h3>
                      <p className="text-xs text-zinc-400">Líderes em assistências</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-400 uppercase">Assists</span>
                </div>

                <div className="space-y-3 flex-1">
                  {estatisticasGerais.garcons.slice(0, 5).map((jog, index) => (
                    <div
                      key={jog.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                            index === 0
                              ? "bg-amber-400 text-zinc-950"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {index + 1}
                        </span>
                        <div className="truncate">
                          <p className="text-sm font-semibold text-white truncate">{jog.nome}</p>
                          <p className="text-[11px] text-zinc-500">{jog.posicao}</p>
                        </div>
                      </div>
                      <span className="text-base font-black text-amber-400 pl-2">
                        {jog.assistencias}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ranking Craques (Nota Média) */}
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Craques da Resenha</h3>
                      <p className="text-xs text-zinc-400">Melhores notas médias</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-purple-400 uppercase">Nota</span>
                </div>

                <div className="space-y-3 flex-1">
                  {estatisticasGerais.craques.slice(0, 5).map((jog, index) => (
                    <div
                      key={jog.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                            index === 0
                              ? "bg-purple-400 text-zinc-950"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {index + 1}
                        </span>
                        <div className="truncate">
                          <p className="text-sm font-semibold text-white truncate">{jog.nome}</p>
                          <p className="text-[11px] text-zinc-500">
                            {jog.vitorias}V em {jog.partidas}J
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-sm font-black text-emerald-400">
                        {Number(jog.notaMedia).toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* ABA 2: JOGADORES / ELENCO                                            */}
        {/* ==================================================================== */}
        {abaAtiva === "jogadores" && (
          <div className="space-y-6">
            {/* Barra de Filtros e Cadastro */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl">
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                {/* Busca */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar jogador por nome ou apelido..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                {/* Ordenar por */}
                <select
                  value={ordenacao}
                  onChange={(e) => setOrdenacao(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 focus:outline-none focus:border-emerald-400"
                >
                  <option value="notaMedia">Ordenar: Maior Nota</option>
                  <option value="gols">Ordenar: Mais Gols</option>
                  <option value="assistencias">Ordenar: Mais Assistências</option>
                  <option value="vitorias">Ordenar: Mais Vitórias</option>
                </select>
              </div>

              <button
                onClick={abrirNovoJogador}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-bold text-sm shadow-lg shadow-emerald-500/15 transition"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                Cadastrar Jogador
              </button>
            </div>

            {/* Pílulas de Filtro por Posição */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {POSICOES.map((pos) => (
                <button
                  key={pos}
                  onClick={() => setFiltroPosicao(pos)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                    filtroPosicao === pos
                      ? "bg-emerald-400 text-zinc-950"
                      : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>

            {/* Grid de Cards dos Jogadores */}
            {jogadoresFiltrados.length === 0 ? (
              <div className="text-center py-16 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl">
                <Users className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white">Nenhum jogador encontrado</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Tente limpar os filtros ou adicione um novo atleta ao banco JSON.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {jogadoresFiltrados.map((jog) => {
                  const aproveitamento =
                    jog.partidas > 0 ? Math.round((jog.vitorias / jog.partidas) * 100) : 0;

                  return (
                    <div
                      key={jog.id}
                      className="group bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 rounded-2xl p-5 transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Topo do Card */}
                        <div className="flex items-start justify-between gap-2 mb-4">
                          <div>
                            <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-1.5">
                              {jog.posicao}
                            </span>
                            <h3 className="font-bold text-white text-base leading-snug">
                              {jog.nome}
                            </h3>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] uppercase font-bold text-zinc-500">
                              Nota
                            </span>
                            <span className="text-lg font-black text-emerald-400">
                              {Number(jog.notaMedia).toFixed(1)}
                            </span>
                          </div>
                        </div>

                        {/* Grade de Estatísticas */}
                        <div className="grid grid-cols-3 gap-2 bg-zinc-950/80 p-3 rounded-xl border border-zinc-800/80 mb-4">
                          <div className="text-center">
                            <p className="text-lg font-black text-white">{jog.gols}</p>
                            <p className="text-[10px] uppercase font-bold text-zinc-500">Gols</p>
                            <div className="flex items-center justify-center gap-1 mt-1">
                              <button
                                onClick={() => ajusteRapidoStat(jog.id, "gols", -1)}
                                className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300"
                                title="Remover 1 gol"
                              >
                                -
                              </button>
                              <button
                                onClick={() => ajusteRapidoStat(jog.id, "gols", 1)}
                                className="w-5 h-5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-xs text-emerald-400 font-bold"
                                title="Adicionar 1 gol"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="text-center border-x border-zinc-800">
                            <p className="text-lg font-black text-white">{jog.assistencias}</p>
                            <p className="text-[10px] uppercase font-bold text-zinc-500">Assists</p>
                            <div className="flex items-center justify-center gap-1 mt-1">
                              <button
                                onClick={() => ajusteRapidoStat(jog.id, "assistencias", -1)}
                                className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300"
                                title="Remover 1 assistência"
                              >
                                -
                              </button>
                              <button
                                onClick={() => ajusteRapidoStat(jog.id, "assistencias", 1)}
                                className="w-5 h-5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-xs text-amber-400 font-bold"
                                title="Adicionar 1 assistência"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="text-center">
                            <p className="text-lg font-black text-white">{jog.vitorias}</p>
                            <p className="text-[10px] uppercase font-bold text-zinc-500">Vitórias</p>
                            <div className="flex items-center justify-center gap-1 mt-1">
                              <button
                                onClick={() => ajusteRapidoStat(jog.id, "vitorias", -1)}
                                className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300"
                                title="Remover 1 vitória"
                              >
                                -
                              </button>
                              <button
                                onClick={() => ajusteRapidoStat(jog.id, "vitorias", 1)}
                                className="w-5 h-5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-xs text-blue-400 font-bold"
                                title="Adicionar 1 vitória"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Rodapé do Card */}
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-xs text-zinc-400">
                        <span>
                          {jog.partidas} jogos ({aproveitamento}% vit.)
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => abrirEditarJogador(jog)}
                            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-emerald-400 transition"
                            title="Editar jogador"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => excluirJogador(jog.id, jog.nome)}
                            className="p-1.5 rounded-lg hover:bg-red-950/60 text-zinc-400 hover:text-red-400 transition"
                            title="Excluir jogador"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* ABA 3: GERADOR / PLACAR DE PARTIDA (RESENHA AO VIVO)                 */}
        {/* ==================================================================== */}
        {abaAtiva === "resenha" && (
          <div className="space-y-6">
            {/* Placar Gigante */}
            <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  Súmula da Resenha
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={sortearTimesEquilibrados}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-emerald-400 border border-zinc-700 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Sortear Times por Nota
                  </button>
                  <button
                    onClick={encerrarESalvarPartida}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-xs font-black transition shadow-lg shadow-emerald-500/20"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Encerrar e Salvar no JSON
                  </button>
                </div>
              </div>

              {/* Placar Central */}
              <div className="grid grid-cols-3 items-center gap-2 sm:gap-6 text-center py-4">
                <div className="space-y-2">
                  <input
                    type="text"
                    value={nomeTimeA}
                    onChange={(e) => setNomeTimeA(e.target.value)}
                    className="w-full text-center bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-emerald-400 text-sm sm:text-xl font-black text-emerald-400 focus:outline-none"
                  />
                  <p className="text-xs text-zinc-500">{jogadoresTimeA.length} jogadores</p>
                </div>

                <div className="flex items-center justify-center gap-3 sm:gap-6">
                  <span className="text-5xl sm:text-7xl font-black text-white tabular-nums">
                    {placarA}
                  </span>
                  <span className="text-2xl sm:text-3xl font-bold text-zinc-600">X</span>
                  <span className="text-5xl sm:text-7xl font-black text-white tabular-nums">
                    {placarB}
                  </span>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={nomeTimeB}
                    onChange={(e) => setNomeTimeB(e.target.value)}
                    className="w-full text-center bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-amber-400 text-sm sm:text-xl font-black text-amber-400 focus:outline-none"
                  />
                  <p className="text-xs text-zinc-500">{jogadoresTimeB.length} jogadores</p>
                </div>
              </div>

              {/* Formulário de Registrar Gol */}
              <form
                onSubmit={registrarGolPartida}
                className="mt-6 pt-6 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-4 gap-3"
              >
                <div>
                  <label className="block text-[11px] font-bold uppercase text-zinc-400 mb-1">
                    Time que marcou
                  </label>
                  <select
                    value={timeGolSelecionado}
                    onChange={(e) => {
                      setTimeGolSelecionado(e.target.value);
                      setAutorGolId("");
                      setAssistenteGolId("");
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:border-emerald-400 focus:outline-none"
                  >
                    <option value="A">{nomeTimeA}</option>
                    <option value="B">{nomeTimeB}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-zinc-400 mb-1">
                    Autor do Gol *
                  </label>
                  <select
                    value={autorGolId}
                    onChange={(e) => setAutorGolId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:border-emerald-400 focus:outline-none"
                  >
                    <option value="">Selecione o jogador...</option>
                    {(timeGolSelecionado === "A" ? jogadoresTimeA : jogadoresTimeB).map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-zinc-400 mb-1">
                    Assistência (Opcional)
                  </label>
                  <select
                    value={assistenteGolId}
                    onChange={(e) => setAssistenteGolId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:border-emerald-400 focus:outline-none"
                  >
                    <option value="">Sem assistência</option>
                    {(timeGolSelecionado === "A" ? jogadoresTimeA : jogadoresTimeB)
                      .filter((j) => j.id !== autorGolId)
                      .map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.nome}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-black text-sm transition flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    Registrar Gol
                  </button>
                </div>
              </form>
            </div>

            {/* Escalação dos Times + Linha do Tempo */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Time A */}
              <div className="bg-zinc-900/80 border border-emerald-500/30 rounded-2xl p-5">
                <h3 className="font-bold text-emerald-400 flex items-center justify-between mb-3">
                  <span>{nomeTimeA}</span>
                  <span className="text-xs bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    {jogadoresTimeA.length} atletas
                  </span>
                </h3>
                <div className="space-y-2">
                  {jogadoresTimeA.map((j) => (
                    <div
                      key={j.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-white">{j.nome}</p>
                        <p className="text-[11px] text-zinc-500">
                          {j.posicao} • Nota {j.notaMedia}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => alternarTimeJogador(j.id, "B")}
                          className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 text-xs font-bold hover:bg-amber-500/20"
                          title="Mover para Time B"
                        >
                          → B
                        </button>
                        <button
                          onClick={() => alternarTimeJogador(j.id, "NONE")}
                          className="px-2 py-1 rounded bg-zinc-800 text-zinc-400 text-xs hover:text-white"
                          title="Tirar da partida"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                  {jogadoresTimeA.length === 0 && (
                    <p className="text-xs text-zinc-500 py-4 text-center">
                      Nenhum jogador escalado neste time.
                    </p>
                  )}
                </div>
              </div>

              {/* Time B */}
              <div className="bg-zinc-900/80 border border-amber-500/30 rounded-2xl p-5">
                <h3 className="font-bold text-amber-400 flex items-center justify-between mb-3">
                  <span>{nomeTimeB}</span>
                  <span className="text-xs bg-amber-500/10 px-2 py-0.5 rounded-md">
                    {jogadoresTimeB.length} atletas
                  </span>
                </h3>
                <div className="space-y-2">
                  {jogadoresTimeB.map((j) => (
                    <div
                      key={j.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-white">{j.nome}</p>
                        <p className="text-[11px] text-zinc-500">
                          {j.posicao} • Nota {j.notaMedia}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => alternarTimeJogador(j.id, "A")}
                          className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20"
                          title="Mover para Time A"
                        >
                          ← A
                        </button>
                        <button
                          onClick={() => alternarTimeJogador(j.id, "NONE")}
                          className="px-2 py-1 rounded bg-zinc-800 text-zinc-400 text-xs hover:text-white"
                          title="Tirar da partida"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                  {jogadoresTimeB.length === 0 && (
                    <p className="text-xs text-zinc-500 py-4 text-center">
                      Nenhum jogador escalado neste time.
                    </p>
                  )}
                </div>
              </div>

              {/* Lances da Partida + Banco de Reservas */}
              <div className="space-y-6">
                {/* Lances */}
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
                  <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    Lances da Partida ({eventosPartida.length})
                  </h3>
                  {eventosPartida.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-3">
                      Nenhum gol registrado ainda nesta partida.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {eventosPartida.map((ev) => {
                        const autor = jogadores.find((j) => j.id === ev.autorId);
                        const assist = jogadores.find((j) => j.id === ev.assistenteId);
                        return (
                          <div
                            key={ev.id}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs"
                          >
                            <div>
                              <span
                                className={`font-bold ${
                                  ev.time === "A" ? "text-emerald-400" : "text-amber-400"
                                }`}
                              >
                                ⚽ {autor?.nome || "Jogador"}
                              </span>
                              {assist && (
                                <p className="text-zinc-400 mt-0.5">
                                  👟 Assist: {assist.nome}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => removerEventoPartida(ev.id)}
                              className="text-zinc-500 hover:text-red-400 p-1"
                              title="Anular gol"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Disponíveis para escalar */}
                {jogadoresSemTime.length > 0 && (
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
                    <h3 className="font-bold text-zinc-300 text-sm mb-3">
                      Disponíveis / Banco ({jogadoresSemTime.length})
                    </h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {jogadoresSemTime.map((j) => (
                        <div
                          key={j.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-xs"
                        >
                          <span className="text-zinc-200 font-medium truncate pr-2">{j.nome}</span>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => alternarTimeJogador(j.id, "A")}
                              className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-400 font-bold hover:bg-emerald-500/25"
                            >
                              + Time A
                            </button>
                            <button
                              onClick={() => alternarTimeJogador(j.id, "B")}
                              className="px-2 py-1 rounded bg-amber-500/15 text-amber-400 font-bold hover:bg-amber-500/25"
                            >
                              + Time B
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Histórico de Partidas Encerradas */}
            {historicoPartidas.length > 0 && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
                <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  Últimas Partidas Salvas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {historicoPartidas.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-emerald-400 truncate max-w-[35%]">
                        {p.timeA}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-zinc-900 font-black text-white">
                        {p.placarA} x {p.placarB}
                      </span>
                      <span className="font-semibold text-amber-400 truncate max-w-[35%] text-right">
                        {p.timeB}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* ABA 4: VISUALIZADOR E GERENCIADOR DO ARQUIVO JSON                    */}
        {/* ==================================================================== */}
        {abaAtiva === "json" && (
          <div className="space-y-6">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <FileJson className="w-6 h-6 text-emerald-400" />
                    Banco de Dados JSON (jogadores.json)
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    Seus dados ficam salvos automaticamente no navegador. Use os botões abaixo para baixar o arquivo <code
                    className="text-emerald-400">jogadores.json</code> atualizado ou importar um backup.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold transition"
                  >
                    <Upload className="w-4 h-4 text-emerald-400" />
                    Importar JSON
                  </button>
                  <button
                    onClick={exportarJSON}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-sm font-bold transition"
                  >
                    <Download className="w-4 h-4" />
                    Baixar jogadores.json
                  </button>
                  <button
                    onClick={() => setConfirmarResetAberto(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-semibold transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Resetar Padrão
                  </button>
                </div>
              </div>

              {confirmarResetAberto && (
                <div className="mb-6 p-4 rounded-xl bg-red-950/50 border border-red-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <p className="text-sm text-red-200">
                    Tem certeza? Isso apagará suas edições locais e restaurará os 8 jogadores iniciais.
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setConfirmarResetAberto(false)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={restaurarBancoPadrao}
                      className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold"
                    >
                      Sim, restaurar JSON
                    </button>
                  </div>
                </div>
              )}

              {/* Preview do Código JSON em Tempo Real */}
              <div className="relative">
                <div className="flex items-center justify-between px-4 py-2 bg-zinc-950 border border-b-0 border-zinc-800 rounded-t-xl text-xs text-zinc-400 font-mono">
                  <span>jogadores.json ({jogadores.length} registros)</span>
                  <span className="text-emerald-400">UTF-8 • Sincronizado</span>
                </div>
                <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-b-xl text-xs sm:text-sm font-mono text-emerald-300 overflow-x-auto max-h-[450px]">
                  {JSON.stringify(jogadores, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ====================================================================== */}
      {/* MODAL DE CADASTRO / EDIÇÃO DE JOGADOR                                  */}
      {/* ====================================================================== */}
      {modalJogadorAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h3 className="text-lg font-black text-white">
                {jogadorEditando ? "Editar Jogador" : "Novo Jogador na Resenha"}
              </h3>
              <button
                onClick={() => setModalJogadorAberto(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={salvarJogador} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-400 mb-1">
                  Nome ou Apelido *
                </label>
                <input
                  type="text"
                  required
                  value={formJogador.nome}
                  onChange={(e) => setFormJogador({ ...formJogador, nome: e.target.value })}
                  placeholder="Ex: João 'Canhota' Pereira"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-400 mb-1">
                    Posição
                  </label>
                  <select
                    value={formJogador.posicao}
                    onChange={(e) => setFormJogador({ ...formJogador, posicao: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:border-emerald-400 focus:outline-none"
                  >
                    {POSICOES.filter((p) => p !== "Todos").map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-400 mb-1">
                    Nota Média (0 a 10)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formJogador.notaMedia}
                    onChange={(e) => setFormJogador({ ...formJogador, notaMedia: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:border-emerald-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-zinc-400 mb-1">
                    Gols
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formJogador.gols}
                    onChange={(e) => setFormJogador({ ...formJogador, gols: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-zinc-400 mb-1">
                    Assists
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formJogador.assistencias}
                    onChange={(e) =>
                      setFormJogador({ ...formJogador, assistencias: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-zinc-400 mb-1">
                    Vitórias
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formJogador.vitorias}
                    onChange={(e) => setFormJogador({ ...formJogador, vitorias: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-zinc-400 mb-1">
                    Partidas
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formJogador.partidas}
                    onChange={(e) => setFormJogador({ ...formJogador, partidas: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:border-emerald-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setModalJogadorAberto(false)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoJogador}
                  className="px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-sm font-black"
                >
                  {salvandoJogador ? "Salvando..." : "Salvar Jogador"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
