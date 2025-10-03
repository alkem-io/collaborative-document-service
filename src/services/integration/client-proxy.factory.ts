import { ClientProxy, ClientProxyFactory, RmqOptions, Transport } from '@nestjs/microservices';

export interface ClientProxyConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  heartbeat: number;
  queue: string;
}

/**
 * @throws Error if something goes wrong
 * @param config
 */
export const clientProxyFactory = (config: ClientProxyConfig): ClientProxy => {
  const { host, port, user, password, heartbeat: _heartbeat, queue } = config;
  const heartbeat = process.env.NODE_ENV === 'production' ? _heartbeat : _heartbeat * 3;

  const options: RmqOptions = {
    transport: Transport.RMQ,
    options: {
      urls: [
        {
          protocol: 'amqp',
          hostname: host,
          username: user,
          password,
          port,
          heartbeat,
        },
      ],
      queue,
      queueOptions: { durable: true },
      noAck: true,
    },
  };

  return ClientProxyFactory.create(options);
};
