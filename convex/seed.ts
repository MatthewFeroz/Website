import { mutation } from "./_generated/server";

/**
 * Seed the database with sample quiz data for testing
 * Run this once via the Convex dashboard or CLI
 */
export const seedSampleData = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existingQuizzes = await ctx.db.query("quizzes").collect();
    if (existingQuizzes.length > 0) {
      return { message: "Database already has quizzes. Skipping seed." };
    }

    // Sample Quiz 1: Python Basics
    await ctx.db.insert("quizzes", {
      title: "Python Fundamentals",
      description: "Test your knowledge of Python basics including data types, loops, and functions.",
      category: "python-basics",
      difficulty: "easy",
      passingScore: 70,
      estimatedMinutes: 10,
      isActive: true,
      questions: [
        {
          id: "py-1",
          question: "What is the output of print(type([]))?",
          options: ["<class 'list'>", "<class 'array'>", "<class 'tuple'>", "<class 'dict'>"],
          correctOptionIndex: 0,
          explanation: "In Python, [] creates an empty list, so type([]) returns <class 'list'>.",
        },
        {
          id: "py-2",
          question: "Which keyword is used to define a function in Python?",
          options: ["function", "func", "def", "define"],
          correctOptionIndex: 2,
          explanation: "Python uses the 'def' keyword to define functions.",
        },
        {
          id: "py-3",
          question: "What does the 'len()' function return for the string 'Hello'?",
          options: ["4", "5", "6", "Error"],
          correctOptionIndex: 1,
          explanation: "'Hello' has 5 characters, so len('Hello') returns 5.",
        },
        {
          id: "py-4",
          question: "How do you start a comment in Python?",
          options: ["//", "/*", "#", "--"],
          correctOptionIndex: 2,
          explanation: "Python uses # for single-line comments.",
        },
        {
          id: "py-5",
          question: "What is the result of 3 ** 2 in Python?",
          options: ["6", "9", "5", "Error"],
          correctOptionIndex: 1,
          explanation: "** is the exponentiation operator. 3 ** 2 = 3² = 9.",
        },
      ],
    });

    // Sample Quiz 2: Arrays & Two Pointers
    await ctx.db.insert("quizzes", {
      title: "Arrays & Two Pointers",
      description: "Master the two-pointer technique for solving array problems efficiently.",
      category: "arrays",
      difficulty: "medium",
      passingScore: 70,
      estimatedMinutes: 15,
      isActive: true,
      questions: [
        {
          id: "arr-1",
          question: "What is the time complexity of the two-pointer technique for finding a pair with a given sum in a sorted array?",
          options: ["O(n²)", "O(n log n)", "O(n)", "O(log n)"],
          correctOptionIndex: 2,
          explanation: "Two pointers traverse the array once from both ends, giving O(n) time complexity.",
        },
        {
          id: "arr-2",
          question: "In the 'Container With Most Water' problem, why do we move the pointer at the shorter line?",
          options: [
            "To maximize width",
            "Moving the taller line can only decrease area",
            "Moving the shorter line might find a taller line",
            "It doesn't matter which pointer we move"
          ],
          correctOptionIndex: 2,
          explanation: "The area is limited by the shorter line. Moving it gives a chance to find a taller line that could increase area.",
        },
        {
          id: "arr-3",
          question: "For the 'Remove Duplicates from Sorted Array' problem, what does the slow pointer represent?",
          options: [
            "The current element being checked",
            "The position where the next unique element should go",
            "The last duplicate found",
            "The array length"
          ],
          correctOptionIndex: 1,
          explanation: "The slow pointer tracks where to place the next unique element in-place.",
        },
        {
          id: "arr-4",
          question: "What is the space complexity of the two-pointer approach?",
          options: ["O(n)", "O(log n)", "O(1)", "O(n²)"],
          correctOptionIndex: 2,
          explanation: "Two pointers only use a constant amount of extra space regardless of input size.",
        },
        {
          id: "arr-5",
          question: "When should you NOT use the two-pointer technique?",
          options: [
            "When the array is sorted",
            "When you need to find pairs with a condition",
            "When you need to track all possible combinations",
            "When reversing an array in-place"
          ],
          correctOptionIndex: 2,
          explanation: "Two pointers work by eliminating possibilities. If you need ALL combinations, you typically need O(n²) approaches.",
        },
      ],
    });

    // Sample Quiz 3: Big O Notation
    await ctx.db.insert("quizzes", {
      title: "Big O Complexity Analysis",
      description: "Understand time and space complexity for technical interviews.",
      category: "fundamentals",
      difficulty: "easy",
      passingScore: 80,
      estimatedMinutes: 10,
      isActive: true,
      questions: [
        {
          id: "bigo-1",
          question: "What is the time complexity of accessing an element in an array by index?",
          options: ["O(n)", "O(1)", "O(log n)", "O(n²)"],
          correctOptionIndex: 1,
          explanation: "Array access by index is O(1) because arrays provide direct memory access.",
        },
        {
          id: "bigo-2",
          question: "What is the time complexity of binary search?",
          options: ["O(n)", "O(1)", "O(log n)", "O(n log n)"],
          correctOptionIndex: 2,
          explanation: "Binary search halves the search space each iteration, giving O(log n).",
        },
        {
          id: "bigo-3",
          question: "If you have nested loops where each iterates n times, what's the complexity?",
          options: ["O(n)", "O(2n)", "O(n²)", "O(n + n)"],
          correctOptionIndex: 2,
          explanation: "Nested loops multiply: n × n = O(n²).",
        },
        {
          id: "bigo-4",
          question: "What is the time complexity of sorting using merge sort?",
          options: ["O(n)", "O(n²)", "O(n log n)", "O(log n)"],
          correctOptionIndex: 2,
          explanation: "Merge sort divides the array (log n levels) and merges at each level (n work), giving O(n log n).",
        },
        {
          id: "bigo-5",
          question: "Which complexity is most efficient for large inputs?",
          options: ["O(n²)", "O(n log n)", "O(2^n)", "O(n!)"],
          correctOptionIndex: 1,
          explanation: "O(n log n) grows much slower than the others as n increases.",
        },
      ],
    });

    // Create a sample access code for testing
    await ctx.db.insert("accessCodes", {
      code: "TEST-CODE-1234",
      email: "test@example.com",
      purchasedAt: Date.now(),
      isUsed: false,
    });

    return {
      message: "Seeded 3 quizzes and 1 test access code (TEST-CODE-1234)",
    };
  },
});

/**
 * Seed the diagnostic quiz (free, no auth required)
 * Run this via the Convex dashboard or CLI
 */
export const seedDiagnosticQuiz = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existingDiagnostics = await ctx.db.query("diagnosticQuizzes").collect();
    if (existingDiagnostics.length > 0) {
      return { message: "Diagnostic quiz already exists. Skipping seed." };
    }

    // Create the diagnostic quiz
    await ctx.db.insert("diagnosticQuizzes", {
      title: "Skill Assessment",
      description: "Assess your Python and LeetCode skills to get personalized recommendations.",
      version: 1,
      estimatedMinutes: 25,
      isActive: true,
      sections: [
        {
          category: "python-basics",
          categoryDisplayName: "Python Fundamentals",
          questions: [
            {
              id: "diag-py-1",
              question: "What is the output of print(type([]))?",
              options: ["<class 'list'>", "<class 'array'>", "<class 'tuple'>", "<class 'dict'>"],
              correctOptionIndex: 0,
              difficulty: "easy",
            },
            {
              id: "diag-py-2",
              question: "Which keyword is used to define a function in Python?",
              options: ["function", "func", "def", "define"],
              correctOptionIndex: 2,
              difficulty: "easy",
            },
            {
              id: "diag-py-3",
              question: "What does the 'len()' function return for the string 'Hello'?",
              options: ["4", "5", "6", "Error"],
              correctOptionIndex: 1,
              difficulty: "easy",
            },
            {
              id: "diag-py-4",
              question: "What is the result of 3 ** 2 in Python?",
              options: ["6", "9", "5", "Error"],
              correctOptionIndex: 1,
              difficulty: "easy",
            },
            {
              id: "diag-py-5",
              question: "How do you create an empty dictionary in Python?",
              options: ["[]", "{}", "()", "dict[]"],
              correctOptionIndex: 1,
              difficulty: "easy",
            },
          ],
        },
        {
          category: "data-structures",
          categoryDisplayName: "Data Structures",
          questions: [
            {
              id: "diag-ds-1",
              question: "What is the time complexity of accessing an element in an array by index?",
              options: ["O(n)", "O(1)", "O(log n)", "O(n²)"],
              correctOptionIndex: 1,
              difficulty: "easy",
            },
            {
              id: "diag-ds-2",
              question: "Which data structure uses LIFO (Last In, First Out) principle?",
              options: ["Queue", "Stack", "Linked List", "Tree"],
              correctOptionIndex: 1,
              difficulty: "easy",
            },
            {
              id: "diag-ds-3",
              question: "What is the time complexity of searching in a hash table (average case)?",
              options: ["O(n)", "O(1)", "O(log n)", "O(n²)"],
              correctOptionIndex: 1,
              difficulty: "medium",
            },
            {
              id: "diag-ds-4",
              question: "Which data structure is best for implementing a priority queue?",
              options: ["Array", "Linked List", "Heap", "Stack"],
              correctOptionIndex: 2,
              difficulty: "medium",
            },
            {
              id: "diag-ds-5",
              question: "What is the space complexity of a recursive function that makes n recursive calls?",
              options: ["O(1)", "O(n)", "O(log n)", "O(n²)"],
              correctOptionIndex: 1,
              difficulty: "medium",
            },
          ],
        },
        {
          category: "algorithms",
          categoryDisplayName: "Algorithms",
          questions: [
            {
              id: "diag-alg-1",
              question: "What is the time complexity of binary search?",
              options: ["O(n)", "O(1)", "O(log n)", "O(n log n)"],
              correctOptionIndex: 2,
              difficulty: "easy",
            },
            {
              id: "diag-alg-2",
              question: "Which sorting algorithm has O(n log n) average time complexity?",
              options: ["Bubble Sort", "Selection Sort", "Merge Sort", "Insertion Sort"],
              correctOptionIndex: 2,
              difficulty: "easy",
            },
            {
              id: "diag-alg-3",
              question: "In the two-pointer technique, what typically needs to be true about the input array?",
              options: ["It must be empty", "It must be sorted", "It must have even length", "It must contain only positive numbers"],
              correctOptionIndex: 1,
              difficulty: "medium",
            },
            {
              id: "diag-alg-4",
              question: "What is the time complexity of BFS and DFS for a graph with V vertices and E edges?",
              options: ["O(V)", "O(E)", "O(V + E)", "O(V × E)"],
              correctOptionIndex: 2,
              difficulty: "medium",
            },
            {
              id: "diag-alg-5",
              question: "Which technique is best for solving the 'Maximum Subarray Sum' problem optimally?",
              options: ["Brute Force", "Two Pointers", "Kadane's Algorithm", "Binary Search"],
              correctOptionIndex: 2,
              difficulty: "medium",
            },
          ],
        },
        {
          category: "problem-solving",
          categoryDisplayName: "Problem Solving Patterns",
          questions: [
            {
              id: "diag-ps-1",
              question: "The sliding window technique is most useful for problems involving:",
              options: ["Searching in trees", "Contiguous subarrays/substrings", "Graph traversal", "Sorting"],
              correctOptionIndex: 1,
              difficulty: "medium",
            },
            {
              id: "diag-ps-2",
              question: "When should you use dynamic programming?",
              options: ["When the problem has no pattern", "When there are overlapping subproblems", "When the input is unsorted", "When recursion is not allowed"],
              correctOptionIndex: 1,
              difficulty: "medium",
            },
            {
              id: "diag-ps-3",
              question: "What pattern is typically used for 'Find all pairs that sum to X' in a sorted array?",
              options: ["Sliding Window", "Two Pointers", "Binary Search Tree", "Backtracking"],
              correctOptionIndex: 1,
              difficulty: "easy",
            },
            {
              id: "diag-ps-4",
              question: "Which approach is best for generating all permutations of a set?",
              options: ["Dynamic Programming", "Greedy", "Backtracking", "Divide and Conquer"],
              correctOptionIndex: 2,
              difficulty: "medium",
            },
            {
              id: "diag-ps-5",
              question: "For problems asking 'minimum/maximum in k window', which pattern is most efficient?",
              options: ["Two Pointers", "Sliding Window with Deque", "Binary Search", "Hash Map"],
              correctOptionIndex: 1,
              difficulty: "hard",
            },
          ],
        },
      ],
    });

    return {
      message: "Seeded diagnostic quiz with 4 sections and 20 questions",
    };
  },
});
