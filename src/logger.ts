import pino from "pino"

function getPinoTransportConfig(name: string) {
  const transports: pino.TransportTargetOptions[] = [];

  if (process.env.NODE_ENV === "production") {
    transports.push({
      target: "pino/file",
      options: {
        destination: `./logs/${name}.log`,
        mkdir: true,
      },
    });
  } else {
    transports.push({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
      // level: 'debug',
    });
  }

  // if (process.env.NODE_ENV === 'production') {
  //   transports.push({
  //     target: 'pino-pretty', // 即使在生产环境，也可以用 pino-pretty 方便查看
  //     options: {
  //       destination: 1, // 1 表示 stdout
  //       colorize: false, // 生产环境不建议彩色，因为可能被转发到文件系统
  //     },
  //     level: 'info', // 只输出 info 及以上级别到控制台
  //   });
  // }

  return transports;
}

export type LoggerProviderArgs = {
  name: string
}

export function createLogger(args: LoggerProviderArgs): pino.Logger {
  return pino({
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    transport: {
      targets: getPinoTransportConfig(args.name)
    },
    base: {
      pid: process.pid,
      hostname: process.env.HOSTNAME || "localhost",
    }
  }).child({ name: args.name })
}
