// chat.ts

// Interface para o formato das mensagens que serão enviadas e recebidas
interface ChatMessage {
  user: string;
  text: string; // Mudado de 'message' para 'text' para evitar conflitos com propriedades JS nativas, embora 'message' também funcionasse
  timestamp: number; // Para ordenar as mensagens se necessário
}

// URL do seu servidor WebSocket Spring Boot
// Certifique-se de que a porta e o endpoint estão corretos!
const websocketUrl: string = 'ws://localhost:4250/chat-websocket';

let socket: WebSocket | null = null;
let currentUsername: string = '';

// Elementos do DOM
const messagesDiv = document.getElementById('messages') as HTMLDivElement;
const usernameInput = document.getElementById('usernameInput') as HTMLInputElement;
const messageInput = document.getElementById('messageInput') as HTMLInputElement;
const sendButton = document.getElementById('sendButton') as HTMLButtonElement;
const statusParagraph = document.getElementById('status') as HTMLParagraphElement;

// --- Funções de UI ---

function appendMessage(user: string, text: string, isSelf: boolean = false): void {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  messageElement.classList.add(isSelf ? 'self' : 'other');

  const usernameSpan = document.createElement('strong');
  usernameSpan.textContent = user; // Apenas o nome, sem o ': '

  const textNode = document.createTextNode(text);

  messageElement.appendChild(usernameSpan);
  messageElement.appendChild(document.createElement('br')); // Quebra de linha após o nome
  messageElement.appendChild(textNode);

  messagesDiv.appendChild(messageElement);

  // Rolar para a última mensagem para manter o foco no chat mais recente
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function updateStatus(message: string, color: string = '#666'): void {
  if (statusParagraph) {
    statusParagraph.textContent = message;
    statusParagraph.style.color = color;
  }
}

function setInputState(connected: boolean): void {
  if (messageInput) messageInput.disabled = !connected;
  if (sendButton) sendButton.disabled = !connected;
  if (usernameInput) usernameInput.disabled = !connected; // Desabilita o nome após conectar
}

// --- Lógica WebSocket ---

function connectWebSocket(): void {
  updateStatus('Conectando...', '#666');
  setInputState(false); // Desabilita inputs enquanto tenta conectar

  socket = new WebSocket(websocketUrl);

  socket.onopen = (event: Event) => {
    updateStatus('Conectado! Digite sua mensagem.', 'green');
    setInputState(true);
    appendMessage('Sistema', 'Conectado ao servidor de chat.', false);
    messageInput.focus(); // Coloca o foco no campo de mensagem
  };

  socket.onmessage = (event: MessageEvent) => {
    try {
      const receivedData: ChatMessage = JSON.parse(event.data);
      if (receivedData.user && receivedData.text) {
        const isSelfMessage: boolean = receivedData.user === currentUsername;
        appendMessage(receivedData.user, receivedData.text, isSelfMessage);
      } else {
        console.warn('Mensagem recebida com formato inesperado:', receivedData);
      }
    } catch (e) {
      console.error('Erro ao processar mensagem recebida:', e);
    }
  };

  socket.onclose = (event: CloseEvent) => {
    updateStatus(`Desconectado. Código: ${event.code}, Razão: ${event.reason || 'N/A'}`, 'red');
    setInputState(false);
    appendMessage('Sistema', 'Desconectado do chat. Tentando reconectar em 5 segundos...', false);
    // Tenta reconectar a menos que seja uma desconexão normal (código 1000)
    if (event.code !== 1000) {
      setTimeout(connectWebSocket, 5000);
    }
  };

  socket.onerror = (error: Event) => {
    console.error('Erro no WebSocket:', error);
    updateStatus('Erro na conexão. Verifique o console.', 'red');
    if (socket) {
      socket.close(); // Tenta fechar para acionar o onclose e a reconexão
    }
  };
}

function sendMessage(): void {
  const messageText = messageInput.value.trim();
  if (messageText === '') {
    return; // Não envia mensagens vazias
  }
  if (currentUsername === '') {
    alert('Por favor, digite seu nome antes de enviar uma mensagem.');
    usernameInput.focus();
    return;
  }

  if (socket && socket.readyState === WebSocket.OPEN) {
    const chatMessage: ChatMessage = {
      user: currentUsername,
      text: messageText,
      timestamp: Date.now()
    };
    socket.send(JSON.stringify(chatMessage));
    messageInput.value = ''; // Limpa o input após enviar
  } else {
    updateStatus('Não conectado ao servidor.', 'orange');
    appendMessage('Sistema', 'Não foi possível enviar a mensagem. Conecte-se primeiro.', false);
  }
}

function disconnectWebSocket(): void {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close(1000, 'Desconexão manual do cliente');
    updateStatus('Desconectando...', 'blue');
    console.log('Desconexão WebSocket solicitada.');
  } else {
    console.log('Nenhuma conexão WebSocket ativa para desconectar.');
  }
}

// --- Event Listeners ---

// Quando o DOM estiver completamente carregado, configure os listeners e inicie a conexão
document.addEventListener('DOMContentLoaded', () => {
  // Configura o nome de usuário ao sair do campo
  usernameInput.addEventListener('blur', () => {
    const newUsername = usernameInput.value.trim();
    if (newUsername !== '') {
      currentUsername = newUsername;
      updateStatus(`Seu nome de usuário: ${currentUsername}`, '#0056b3');
      // Se já estiver conectado, o campo de mensagem já será habilitado
      if (socket && socket.readyState === WebSocket.OPEN) {
        messageInput.focus();
      }
    }
  });

  // Se o usuário pressionar Enter no campo de nome, define o nome e foca na mensagem
  usernameInput.addEventListener('keypress', (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      usernameInput.blur(); // Dispara o evento 'blur'
    }
  });

  // Botão de envio
  sendButton.addEventListener('click', sendMessage);

  // Enviar mensagem ao pressionar Enter no campo de mensagem
  messageInput.addEventListener('keypress', (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      sendMessage();
    }
  });

  // Iniciar a conexão WebSocket
  connectWebSocket();
});

// Exponha funções globalmente para o HTML (se usar onclick no HTML)
// Em um ambiente Angular, você chamaria essas funções a partir dos métodos do componente
(window as any).sendWebSocketMessage = sendMessage;
(window as any).disconnectWebSocket = disconnectWebSocket;
