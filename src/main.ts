// chat.ts

// Interface para o formato das mensagens
interface ChatMessage {
  user: string;
  text: string;
  timestamp: number;
}

const websocketUrl: string = 'ws://25.2.135.72:4250/chat-websocket';

let socket: WebSocket | null = null;
let currentUsername: string = '';

// Seletores DOM
const messagesDiv = document.getElementById('messages') as HTMLDivElement | null;
const usernameInput = document.getElementById('usernameInput') as HTMLInputElement | null;
const messageInput = document.getElementById('messageInput') as HTMLInputElement | null;
const sendButton = document.getElementById('sendButton') as HTMLButtonElement | null;
const statusParagraph = document.getElementById('status') as HTMLParagraphElement | null;

// Função para adicionar uma mensagem ao chat
function appendMessage(user: string, text: string, isSelf: boolean = false): void {
  if (!messagesDiv) return;

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
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Atualiza o parágrafo de status
function updateStatus(message: string, color: string = '#666'): void {
  if (statusParagraph) {
    statusParagraph.textContent = message;
    statusParagraph.style.color = color;
  }
}

// Habilita ou desabilita os campos
function setInputState(connected: boolean): void {
  if (messageInput) messageInput.disabled = !connected;
  if (sendButton) sendButton.disabled = !connected;
  if (usernameInput) usernameInput.disabled = connected; // Desabilita nome se conectado
}

// Conecta ao WebSocket
function connectWebSocket(): void {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.warn('Já conectado.');
    return;
  }

  updateStatus('Conectando...');
  setInputState(false);

  socket = new WebSocket(websocketUrl);

  socket.onopen = () => {
    if (currentUsername) {
      updateStatus(`${currentUsername} Conectado! Digite sua mensagem.`, 'green');
      setInputState(true);
      appendMessage(currentUsername, 'Conectado ao servidor.', false);
      messageInput?.focus();

      // Envia mensagem para os outros usuários
      const joinMessage: ChatMessage = {
        user: currentUsername,
        text: 'entrou no chat.',
        timestamp: Date.now(),
      };

      socket?.send(JSON.stringify(joinMessage));
    }
  };

  socket.onmessage = (event: MessageEvent) => {
    try {
      const received: ChatMessage = JSON.parse(event.data);
      if (received.user && received.text) {
        const isSelf = received.user === currentUsername;
        appendMessage(received.user, received.text, isSelf);
      }
    } catch (err) {
      console.error('Erro ao processar mensagem:', err);
    }
  };

  socket.onclose = (event: CloseEvent) => {
    updateStatus(`Desconectado (código ${event.code}).`, 'red');
    setInputState(false);
    appendMessage('Sistema', 'Desconectado. Reconnectando em 5s...', false);
    if (event.code !== 1000) {
      setTimeout(connectWebSocket, 5000);
    }
  };

  socket.onerror = (event: Event) => {
    console.error('Erro WebSocket:', event);
    updateStatus('Erro de conexão.', 'red');
    socket?.close();
  };
}

// Envia a mensagem pelo WebSocket
function sendMessage(): void {
  const text = messageInput?.value.trim();
  if (!text || text === '') return;

  if (!currentUsername) {
    alert('Digite seu nome.');
    usernameInput?.focus();
    return;
  }

  if (socket && socket.readyState === WebSocket.OPEN) {
    const msg: ChatMessage = {
      user: currentUsername,
      text,
      timestamp: Date.now(),
    };
    socket.send(JSON.stringify(msg));
    if (messageInput) messageInput.value = '';
  } else {
    updateStatus('Não conectado.', 'orange');
    appendMessage('Sistema', 'Você não está conectado.', false);
  }
}

// Desconecta o WebSocket
function disconnectWebSocket(): void {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close(1000, 'Cliente desconectado');
    updateStatus('Desconectando...', 'blue');
  } else {
    console.log('Sem conexão ativa.');
  }
}

// Listeners e inicialização
document.addEventListener('DOMContentLoaded', () => {
  if (!usernameInput || !messageInput || !sendButton) return;

  const tryConnect = () => {
    const newUser = usernameInput.value.trim();
    if (newUser && (!socket || socket.readyState !== WebSocket.OPEN)) {
      currentUsername = newUser;
      connectWebSocket(); // Agora conecta aqui!
    }
  };

  usernameInput.addEventListener('blur', tryConnect);

  usernameInput.addEventListener('keypress', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      usernameInput.blur(); // Gatilho para o blur
    }
  });

  sendButton.addEventListener('click', sendMessage);

  messageInput.addEventListener('keypress', (e: KeyboardEvent) => {
    if (e.key === 'Enter') sendMessage();
  });

  // Foco automático no nome se vazio
  if (usernameInput.value.trim() === '') {
    usernameInput.focus();
  }
});

// Expõe globalmente para testes (opcional)
(window as any).sendWebSocketMessage = sendMessage;
(window as any).disconnectWebSocket = disconnectWebSocket;
