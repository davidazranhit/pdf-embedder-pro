import { Link } from "react-router-dom";
import { FileX, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const FileUnavailable = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 max-w-md w-full text-center" dir="rtl">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <FileX className="w-10 h-10 text-red-500" />
        </div>
        
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
          הקובץ אינו זמין
        </h1>
        
        <p className="text-gray-600 mb-8 leading-relaxed">
          הקבצים היו זמינים להורדה למשך 3 ימים.
          <br />
          יש להגיש בקשה חדשה כדי לקבל את הקבצים מחדש.
        </p>
        
        <Link to="/request-access">
          <Button 
            size="lg" 
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white gap-2"
          >
            <span>הגש בקשה חדשה</span>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default FileUnavailable;
