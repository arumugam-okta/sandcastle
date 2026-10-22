import { LocalRuntime } from './local.js';
import { DockerRuntime } from './docker.js';

export const createRuntime = () => (process.env.RUNTIME === 'docker' ? new DockerRuntime() : new LocalRuntime());
