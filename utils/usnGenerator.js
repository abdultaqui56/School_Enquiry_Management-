// USN Generator Utility
const USNGenerator = {
    // Prefix mapping for different syllabi
    SYLLABUS_PREFIXES: {
      'STATE': 'ST',
      'ICSE': 'IC',
      'CBSE': 'CB'
    },
  
    // Generate a unique USN based on syllabus and class
    async generateUSN(db, syllabus, studentClass) {
      const prefix = this.SYLLABUS_PREFIXES[syllabus.toUpperCase()];
      if (!prefix) {
        throw new Error('Invalid syllabus type');
      }
  
      // Get current year's last two digits
      const year = new Date().getFullYear().toString().slice(-2);
      
      // Format class as two digits
      const classNum = studentClass.toString().padStart(2, '0');
      
      // Function to generate a random 4-digit number
      const generateSequence = () => Math.floor(1000 + Math.random() * 9000);
  
      // Try to generate a unique USN
      const generateUniqueUSN = async () => {
        const sequence = generateSequence();
        const usn = `${prefix}${year}${classNum}${sequence}`;
  
        // Check if USN exists
        const [existing] = await db.promise().query(
          'SELECT usn FROM approved_list WHERE usn = ?',
          [usn]
        );
  
        if (existing.length === 0) {
          return usn;
        }
        
        // If USN exists, try again recursively
        return generateUniqueUSN();
      };
  
      return generateUniqueUSN();
    },
  
    // Batch update USNs for approved students without USNs
    async batchUpdateUSNs(db) {
      try {
        // Get all approved entries without USNs
        const [entries] = await db.promise().query(
          'SELECT id, syllabus, class FROM approved_list WHERE usn IS NULL OR usn = ""'
        );
  
        for (const entry of entries) {
          try {
            const usn = await this.generateUSN(db, entry.syllabus, entry.class);
            
            await db.promise().query(
              'UPDATE approved_list SET usn = ? WHERE id = ?',
              [usn, entry.id]
            );
  
            console.log(`Updated USN for ID ${entry.id}: ${usn}`);
          } catch (error) {
            console.error(`Error updating USN for ID ${entry.id}:`, error);
          }
        }
  
        return {
          success: true,
          message: `Updated USNs for ${entries.length} entries`
        };
      } catch (error) {
        console.error('Batch USN update error:', error);
        throw error;
      }
    },
  
    // Validate USN format
    validateUSN(usn) {
      // USN format: XX99999999 (where XX is syllabus prefix)
      const usnRegex = /^(ST|IC|CB)\d{8}$/;
      return usnRegex.test(usn);
    }
  };
  
  module.exports = USNGenerator;