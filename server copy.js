const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());

const mfolderPath = path.join(__dirname, 'Mfolder');
const filesListPath = path.join(__dirname, 'Fileslist.json');

const generateId = () => Math.random().toString(36).substr(2, 9);

// Initialize files list if it doesn't exist
const getFilesList = async () => {
    try {
        const data = await fs.readFile(filesListPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

// Save files list
const saveFilesList = async (data) => {
    await fs.writeFile(filesListPath, JSON.stringify(data, null, 2), 'utf-8');
};

async function initializeServer() {
    try {
        await fs.mkdir(mfolderPath, { recursive: true });
        const filesList = await getFilesList();
        await saveFilesList(filesList);
        console.log('Server initialized successfully');
    } catch (error) {
        console.error('Failed to initialize server:', error);
        process.exit(1);
    }
}

app.post('/folders', async (req, res) => {
    try {
        const { folderName } = req.body;
        
        if (!folderName || typeof folderName !== 'string') {
            return res.status(400).json({ error: 'Valid folder name is required' });
        }

        const folderId = generateId();
        const newFolderPath = path.join(mfolderPath, `${folderName}_${folderId}`);
        
        const filesData = await getFilesList();
        
        if (filesData.some(f => f.Folder_name === folderName)) {
            return res.status(409).json({ error: 'Folder name already exists' });
        }
        
        await fs.mkdir(newFolderPath);
        filesData.push({ 
            Folder_id: folderId, 
            Folder_name: folderName, 
            files: [] 
        });
        
        await saveFilesList(filesData);
        
        res.status(201).json({ 
            id: folderId,
            name: folderName,
            path: `${folderName}_${folderId}`
        });
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ 
            error: 'Failed to create folder', 
            details: error.message 
        });
    }
});

app.get('/folders', async (req, res) => {
    try {
        const filesData = await getFilesList();
        res.json({ folders: filesData });
    } catch (error) {
        console.error('Error retrieving folders:', error);
        res.status(500).json({ 
            error: 'Failed to retrieve folders', 
            details: error.message 
        });
    }
});

app.post('/files', async (req, res) => {
    try {
        const { folderPath, fileName, content } = req.body;
        
        if (!folderPath || !fileName || content === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const filesData = await getFilesList();
        const [folderName, folderId] = folderPath.split('_');
        const folder = filesData.find(f => f.Folder_id === folderId);
        
        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        // Check if folder exists in filesystem
        const targetFolderPath = path.join(mfolderPath, folderPath);
        try {
            await fs.access(targetFolderPath);
        } catch (error) {
            return res.status(404).json({ error: 'Folder not found in filesystem' });
        }

        const fileId = generateId();
        const fullFilePath = path.join(targetFolderPath, `${fileName}_${fileId}.js`);
        
        try {
            await fs.writeFile(fullFilePath, content);
        } catch (error) {
            console.error('Error writing file:', error);
            return res.status(500).json({ 
                error: 'Failed to write file', 
                details: error.message 
            });
        }

        folder.files.push({ 
            File_id: fileId, 
            File_name: fileName,
            File_path: `${fileName}_${fileId}.js`
        });
        
        await saveFilesList(filesData);
        
        res.status(201).json({ 
            id: fileId,
            name: fileName,
            path: `${fileName}_${fileId}.js`,
            fullPath: fullFilePath
        });
    } catch (error) {
        console.error('Error creating file:', error);
        res.status(500).json({ 
            error: 'Failed to create file', 
            details: error.message 
        });
    }
});

app.get('/files/:folderPath/:fileName', async (req, res) => {
    try {
        const { folderPath, fileName } = req.params;
        const filePath = path.join(mfolderPath, folderPath, fileName);
        
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({ error: 'File not found' });
        }

        const content = await fs.readFile(filePath, 'utf-8');
        res.json({ content });
    } catch (error) {
        console.error('Error retrieving file:', error);
        res.status(404).json({ 
            error: 'File not found', 
            details: error.message 
        });
    }
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal server error', 
        details: err.message 
    });
});

initializeServer().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Mfolder path: ${mfolderPath}`);
        console.log(`FilesList path: ${filesListPath}`);
    });
}).catch(console.error);