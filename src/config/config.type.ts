export interface ConfigType {
  rabbitmq: {
    connection: {
      host: string;
      port: number;
      user: string;
      password: string;
      heartbeat: number;
    };
  };
  monitoring: {
    logging: {
      enabled: boolean;
      level: string;
      json: boolean;
    };
  };
  settings: {
    application: {
      port: number;
      queue: string;
      queue_response_timeout: number;
      queue_request_retries: number;
      ping_timeout: number;
      ping_interval: number;
      max_http_buffer_size: number;
    };
    collaboration: {
      enabled: boolean;
    };
  };
}
