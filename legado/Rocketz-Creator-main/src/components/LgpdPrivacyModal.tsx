import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Download, 
  Trash2, 
  Lock, 
  Eye, 
  EyeOff, 
  FileText, 
  Check, 
  X, 
  AlertTriangle, 
  Mail, 
  HelpCircle,
  Database,
  UserCheck
} from 'lucide-react';
import { usePrivacy } from '../context/PrivacyContext';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export function LgpdPrivacyModal() {
  const { 
    isLgpdModalOpen, 
    closeLgpdModal, 
    hideValues, 
    toggleHideValues, 
    consentPreferences, 
    updateConsentPreferences,
    lgpdAccepted,
    acceptLgpd
  } = usePrivacy();

  const [activeTab, setActiveTab] = useState<'privacy' | 'export' | 'preferences' | 'delete' | 'dpo'>('privacy');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteRequested, setDeleteRequested] = useState(false);

  if (!isLgpdModalOpen) return null;

  const handleExportData = async () => {
    setIsExporting(true);
    setExportSuccess(false);
    try {
      const currentUser = auth.currentUser;
      let userData: any = {
        meta: {
          exportDate: new Date().toISOString(),
          lgpdLaw: "Lei Geral de Proteção de Dados - Lei nº 13.709/2018",
          userId: currentUser?.uid || "invitado",
          email: currentUser?.email || "N/A"
        },
        profile: null,
        participations: [],
        campaigns: [],
        contracts: []
      };

      if (currentUser?.uid) {
        // Fetch creator or company profile
        const creatorSnap = await getDoc(doc(db, 'creators', currentUser.uid));
        if (creatorSnap.exists()) {
          userData.profile = { type: 'creator', ...creatorSnap.data() };
        } else {
          const companySnap = await getDoc(doc(db, 'companies', currentUser.uid));
          if (companySnap.exists()) {
            userData.profile = { type: 'company', ...companySnap.data() };
          }
        }

        // Fetch participations
        try {
          const partQuery = query(collection(db, 'campaignCreators'), where('creatorId', '==', currentUser.uid));
          const partSnap = await getDocs(partQuery);
          userData.participations = partSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn("Export participations non-fatal:", e);
        }
      }

      // Generate JSON File
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(userData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `relatorio_lgpd_dados_pessoais_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setExportSuccess(true);
    } catch (err) {
      console.error("Erro ao exportar dados LGPD:", err);
      alert("Não foi possível gerar a exportação dos dados no momento. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRequestDeletion = () => {
    if (deleteConfirmText.toUpperCase() !== 'EXCLUIR MEUS DADOS') {
      alert("Por favor, digite exatamente 'EXCLUIR MEUS DADOS' para confirmar a solicitação.");
      return;
    }
    setDeleteRequested(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden my-auto relative z-10">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-tight">
                Central de Privacidade & LGPD
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018)
              </p>
            </div>
          </div>
          <button
            onClick={closeLgpdModal}
            className="w-8 h-8 rounded-lg hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-100 bg-white overflow-x-auto">
          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'privacy'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Lock size={14} />
            Termos & Segurança
          </button>

          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'preferences'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserCheck size={14} />
            Gerenciar Consentimento
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'export'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Download size={14} />
            Exportar Meus Dados
          </button>

          <button
            onClick={() => setActiveTab('delete')}
            className={`px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'delete'
                ? 'border-rose-600 text-rose-600 bg-rose-50/50'
                : 'border-transparent text-slate-500 hover:text-rose-600'
            }`}
          >
            <Trash2 size={14} />
            Exclusão de Dados
          </button>

          <button
            onClick={() => setActiveTab('dpo')}
            className={`px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'dpo'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Mail size={14} />
            Contato DPO
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 text-sm">
          
          {/* TAB 1: Privacy & Terms */}
          {activeTab === 'privacy' && (
            <div className="space-y-5">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <ShieldCheck size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-emerald-950 text-sm">
                    Garantia de Proteção de Dados LGPD
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    A Rocketz se compromete com a transparência, segurança e privacidade total de seus dados pessoais, bancários e de campanhas, respeitando rigorosamente a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-xs uppercase tracking-wider">
                    <Database size={14} />
                    Finalidade da Coleta
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Seus dados pessoais (nome, e-mail, redes sociais, telefone, Chave PIX e histórico de entregas) são coletados estritamente para viabilizar conexões comerciais, contratos de campanhas de influenciadores e pagamentos de cachê.
                  </p>
                </div>

                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-xs uppercase tracking-wider">
                    <Lock size={14} />
                    Segurança e Criptografia
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Utilizamos comunicação criptografada SSL/TLS, banco de dados isolado com controle de acesso baseado em função (RBAC) e regras de segurança rígidas em nuvem para impedir acessos não autorizados.
                  </p>
                </div>
              </div>

              <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-extrabold text-slate-900 text-sm">Modo de Privacidade de Valores em Tela</h5>
                    <p className="text-xs text-slate-500">Oculta orçamentos, valores de cachê e dados financeiros da interface</p>
                  </div>
                  <button
                    onClick={toggleHideValues}
                    className={`px-3.5 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                      hideValues
                        ? 'bg-amber-500 text-white shadow-xs hover:bg-amber-600'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {hideValues ? <EyeOff size={15} /> : <Eye size={15} />}
                    {hideValues ? 'Valores Ocultos' : 'Ocultar Valores'}
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-500 space-y-1">
                <p><strong>Bases Legais Utilizadas:</strong> Execução de Contrato (Art. 7º, V) e Consentimento do Titular (Art. 7º, I).</p>
                <p><strong>Compartilhamento com Terceiros:</strong> Seus dados de perfil comercial são compartilhados exclusivamente com marcas parceiras para seleção de casting sob sua aprovação prévia.</p>
              </div>
            </div>
          )}

          {/* TAB 2: Preferences & Consent */}
          {activeTab === 'preferences' && (
            <div className="space-y-5">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Gerenciamento de Consentimentos e Preferências</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nos termos do Art. 8º da LGPD, você pode alterar ou revogar seu consentimento a qualquer momento.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 border border-slate-200 rounded-xl bg-white flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">Oportunidades Comerciais e Notificações</span>
                    <span className="text-xs text-slate-500">Receber notificações sobre convites de campanhas, briefings e propostas de marcas.</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={consentPreferences.marketing}
                    onChange={(e) => updateConsentPreferences({ marketing: e.target.checked })}
                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="p-4 border border-slate-200 rounded-xl bg-white flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">Exibição em Casting Público de Criadores</span>
                    <span className="text-xs text-slate-500">Permitir que marcas e agências visualizem seu perfil público na busca de criadores.</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={consentPreferences.profilePublic}
                    onChange={(e) => updateConsentPreferences({ profilePublic: e.target.checked })}
                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="p-4 border border-slate-200 rounded-xl bg-white flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">Análise de Métricas e Performance da Plataforma</span>
                    <span className="text-xs text-slate-500">Permitir o uso de métricas de engajamento para aprimorar recomendações de campanhas.</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={consentPreferences.analytics}
                    onChange={(e) => updateConsentPreferences({ analytics: e.target.checked })}
                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              {!lgpdAccepted && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between gap-4">
                  <div>
                    <span className="font-extrabold text-indigo-950 text-xs block">Termos LGPD Pendentes de Aceite</span>
                    <span className="text-xs text-indigo-800">Confirme o aceite dos termos gerais de tratamento de dados.</span>
                  </div>
                  <button
                    onClick={acceptLgpd}
                    className="px-4 py-2 bg-brand-primary hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors shrink-0 cursor-pointer"
                  >
                    Aceitar Termos LGPD
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Export Data */}
          {activeTab === 'export' && (
            <div className="space-y-5">
              <div className="p-4 border border-indigo-100 bg-indigo-50/60 rounded-xl flex items-start gap-3">
                <FileText size={20} className="text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-indigo-950 text-sm">
                    Direito de Portabilidade dos Dados (Art. 18, V - LGPD)
                  </h4>
                  <p className="text-xs text-indigo-800 mt-1 leading-relaxed">
                    Você pode baixar a qualquer momento uma cópia estruturada em formato de arquivo JSON com todos os seus dados cadastrais, informações de perfil, propostas, participações em campanhas e dados de pagamento armazenados no sistema.
                  </p>
                </div>
              </div>

              <div className="p-5 border border-slate-200 rounded-xl bg-white text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 mx-auto flex items-center justify-center">
                  <Download size={24} />
                </div>
                <div>
                  <h5 className="font-extrabold text-slate-900 text-base">Gerar Relatório Completo de Dados Pessoais</h5>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    O arquivo conterá seu perfil cadastral, contatos, dados bancários/PIX cadastrados, contratos e registros de candidaturas.
                  </p>
                </div>

                <button
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="px-6 py-2.5 bg-brand-primary hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 mx-auto cursor-pointer disabled:opacity-50"
                >
                  {isExporting ? (
                    <>Aguarde, compilando dados...</>
                  ) : (
                    <>
                      <Download size={16} />
                      Baixar Meus Dados (JSON)
                    </>
                  )}
                </button>

                {exportSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center justify-center gap-2 max-w-md mx-auto">
                    <Check size={16} className="text-emerald-600" />
                    Arquivo de dados baixado com sucesso!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Delete / Anonymize Data */}
          {activeTab === 'delete' && (
            <div className="space-y-5">
              <div className="p-4 border border-rose-200 bg-rose-50/80 rounded-xl flex items-start gap-3">
                <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-rose-950 text-sm">
                    Direito à Exclusão ou Anonimização (Art. 18, VI - LGPD)
                  </h4>
                  <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                    Você tem o direito de solicitar a eliminação dos seus dados pessoais tratados com o seu consentimento, ressalvadas as hipóteses de guarda obrigatória por obrigação legal ou regulatória (como emissão de notas e comprovantes fiscais).
                  </p>
                </div>
              </div>

              {!deleteRequested ? (
                <div className="p-5 border border-slate-200 rounded-xl bg-white space-y-4">
                  <h5 className="font-extrabold text-slate-900 text-sm">Solicitar Remoção / Encerramento da Conta</h5>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Ao confirmar este pedido, nossa equipe do DPO processará o pedido em até 15 dias úteis, removendo seus contatos, chaves bancárias, histórico de candidaturas ativas e desativando seu perfil nas buscas.
                  </p>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">
                      Digite <strong className="text-rose-600">EXCLUIR MEUS DADOS</strong> abaixo para confirmar:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="EXCLUIR MEUS DADOS"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
                    />
                  </div>

                  <button
                    onClick={handleRequestDeletion}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 size={16} />
                    Enviar Solicitação de Exclusão
                  </button>
                </div>
              ) : (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center font-bold">
                    <Check size={20} />
                  </div>
                  <h5 className="font-extrabold text-emerald-950 text-sm">Solicitação Registrada com Sucesso</h5>
                  <p className="text-xs text-emerald-800 leading-relaxed max-w-md mx-auto">
                    Sua solicitação de exclusão de dados sob os termos da LGPD foi recebida pelo nosso Encarregado de Proteção de Dados (DPO). Você receberá um e-mail de confirmação em até 48h.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: DPO Contact */}
          {activeTab === 'dpo' && (
            <div className="space-y-5">
              <div className="p-5 border border-slate-200 rounded-xl bg-white space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Mail size={20} />
                  </div>
                  <div>
                    <h5 className="font-extrabold text-slate-900 text-sm">Encarregado pelo Tratamento de Dados (DPO)</h5>
                    <p className="text-xs text-slate-500">Canal direto de atendimento sobre a Lei Geral de Proteção de Dados</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2 text-slate-700">
                  <p><strong>Nome do Encarregado / DPO:</strong> Departamento de Privacidade e Segurança Rocketz</p>
                  <p><strong>E-mail de Contato LGPD:</strong> <a href="mailto:dpo@rocketz.com.br" className="text-brand-primary underline font-bold">dpo@rocketz.com.br</a></p>
                  <p><strong>Prazo de Atendimento:</strong> Resposta às solicitações de titulares em até 15 dias (Art. 19, II - LGPD).</p>
                  <p><strong>Endereço Sede:</strong> São Paulo / SP - Brasil</p>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Para dúvidas, esclarecimentos sobre compartilhamento de informações ou revogação formal de consentimento, envie uma mensagem para o e-mail acima informando seu nome completo e e-mail cadastrado.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <ShieldCheck size={16} className="text-emerald-600" />
            Rocketz Platform • LGPD Compliant
          </div>
          <button
            onClick={closeLgpdModal}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
