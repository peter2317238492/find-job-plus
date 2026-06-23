const COMPUTER_USE_AGENT = "computer-use-agent";

class ComputerUseGateway {
  constructor({ executor, eventSink = () => {} } = {}) {
    this.executor = executor || createMissingComputerUseExecutor();
    this.eventSink = eventSink;
    this.nextRequestId = 1;
  }

  async request(operation) {
    if (!operation || !operation.action) {
      throw new Error("Computer-use operation must include an action.");
    }

    const request = {
      id: operation.id || `computer-use-${this.nextRequestId++}`,
      agent: COMPUTER_USE_AGENT,
      platform: operation.platform || "",
      action: operation.action,
      targetUrl: operation.targetUrl || "",
      instructions: operation.instructions || "",
      input: operation.input || {},
      expect: operation.expect || "",
    };

    this.#emit({
      type: "agent:operation",
      agent: COMPUTER_USE_AGENT,
      operation: describeComputerUseRequest(request),
    });
    this.#emit({
      type: "computer-use:request",
      request,
    });

    const result = (await this.executor(request)) || {};
    const status = result.status || "completed";

    this.#emit({
      type: "computer-use:result",
      requestId: request.id,
      status,
    });

    return {
      requestId: request.id,
      ...result,
      status,
    };
  }

  #emit(event) {
    this.eventSink({
      at: new Date().toISOString(),
      ...event,
    });
  }
}

function createComputerUseGateway(options = {}) {
  return new ComputerUseGateway(options);
}

function createMissingComputerUseExecutor() {
  return async (request) => {
    const error = new Error(
      `Computer-use executor is not configured. Route request ${request.id} (${request.action}) to computer-use-agent.`
    );
    error.request = request;
    throw error;
  };
}

function describeComputerUseRequest(request) {
  const platform = request.platform ? `${request.platform}: ` : "";
  return `${platform}${request.action}`;
}

module.exports = {
  COMPUTER_USE_AGENT,
  ComputerUseGateway,
  createComputerUseGateway,
  createMissingComputerUseExecutor,
  describeComputerUseRequest,
};
