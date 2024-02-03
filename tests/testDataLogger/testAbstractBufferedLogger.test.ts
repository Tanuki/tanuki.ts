import AbstractBufferedLogger from "../../src/trackers/abstractBufferedLogger";
import {FunctionExample} from "../../src/models/functionExample";
import FilesystemBufferedLogger from "../../src/trackers/filesystemBufferedLogger";
import BloomFilterFileSystemDriver from "../../src/persistence/bloomFilterFileSystemDriver";


describe('AbstractBufferedLogger', () => {
    let logger: AbstractBufferedLogger;
    let example: FunctionExample;

    beforeEach(() => {
        logger = new FilesystemBufferedLogger()
        // Setup bloom filter mock
        // @ts-ignore
        logger.bloomFilter = {
            lookup: jest.fn().mockReturnValue(false),
            add: jest.fn(),
            size: 1000,
            hashCount: 10,
            bitArray: new Array(1000).fill(false),
            persistence: new BloomFilterFileSystemDriver('/tmp'),
            initBitArray: jest.fn(),
            hashFunctions: jest.fn(),
            save() {
                // @ts-ignore
                this.persistence.save(this.bitArray);
            },
            load() {
                // @ts-ignore
                this.bitArray = this.persistence.load();
            }
        };

        // Mock the persistence check to always succeed
        jest.spyOn(logger, 'ensurePersistenceLocationExists').mockImplementation();

        // Setup example data
        example = new FunctionExample([1,2,3], {})
    });

    describe('logEmbeddableAlign', () => {
        it('should not log data if persistence location cannot be ensured', () => {
            jest.spyOn(logger, 'ensurePersistenceLocationExists').mockImplementation(() => {
                throw new Error('Persistence error');
            });

            const [successfullySaved, newDatapoint] = logger.logEmbeddableAlign('funcHash', example, true);
            expect(successfullySaved).toBe(false);
            expect(newDatapoint).toBe(false);
        });

        it('should log new data if not found in bloom filter', () => {
            const [successfullySaved, newDatapoint] = logger.logEmbeddableAlign('funcHash', example, true);

            expect(successfullySaved).toBe(true);
            expect(newDatapoint).toBe(true);
            expect(logger.bloomFilter.lookup).toHaveBeenCalledWith(expect.any(String));
            expect(logger.bloomFilter.add).toHaveBeenCalledWith(expect.any(String));
            // Add assertions for your method `writeEmbeddableAlignCall` being called
        });

        // Add more tests for when data is found in the bloom filter, and for logSymbolicAlign
    });

    describe('logSymbolicAlign', () => {
        it('should not log data if persistence location cannot be ensured', () => {
            jest.spyOn(logger, 'ensurePersistenceLocationExists').mockImplementation(() => {
                throw new Error('Persistence error');
            });

            const [successfullySaved, newDatapoint] = logger.logSymbolicAlign('funcHash', example);
            expect(successfullySaved).toBe(false);
            expect(newDatapoint).toBe(false);
        });

        it('should log new data if not found in bloom filter', () => {
            const [successfullySaved, newDatapoint] = logger.logSymbolicAlign('funcHash', example);
            expect(successfullySaved).toBe(true);
            expect(newDatapoint).toBe(true);
            expect(logger.bloomFilter.lookup).toHaveBeenCalledWith(expect.any(String));
            expect(logger.bloomFilter.add).toHaveBeenCalledWith(expect.any(String));
        });

        it('should not log data if found in bloom filter', () => {
            (logger.bloomFilter.lookup as jest.Mock).mockReturnValue(true);
            const [successfullySaved, newDatapoint] = logger.logSymbolicAlign('funcHash', example);
            expect(successfullySaved).toBe(false);
            expect(newDatapoint).toBe(false);
            // Verify the bloom filter was checked but not updated
            expect(logger.bloomFilter.lookup).toHaveBeenCalledWith(expect.any(String));
            expect(logger.bloomFilter.add).not.toHaveBeenCalled();
        });
    });
});
