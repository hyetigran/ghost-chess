import { getOrCreateDeviceId } from './device-id';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const AsyncStorage = require('@react-native-async-storage/async-storage');

describe('getOrCreateDeviceId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the persisted id when one already exists', async () => {
    AsyncStorage.getItem.mockResolvedValue('existing-id');

    const id = await getOrCreateDeviceId();

    expect(id).toBe('existing-id');
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('generates and persists a new id when none exists', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    const id = await getOrCreateDeviceId();

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('device_id', id);
  });
});
