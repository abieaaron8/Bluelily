import heapq

# Campus Graph
campus = {
    'A': ['L', 'C'],
    'L': ['G', 'H'],
    'C': ['E', 'M'],
    'G': [],
    'H': [],
    'E': ['P'],
    'M': [],
    'P': []
}

# Heuristic Values
h = {
    'A': 6,
    'L': 5,
    'C': 3,
    'G': 7,
    'H': 6,
    'E': 1,
    'M': 4,
    'P': 0
}


def greedy_search(graph, heuristic, start, goal):

    pq = []
    heapq.heappush(pq, (heuristic[start], start))

    visited = set()
    parent = {}

    while pq:

        value, current = heapq.heappop(pq)

        if current in visited:
            continue

        visited.add(current)

        if current == goal:
            break

        for node in graph[current]:

            if node not in visited:

                parent[node] = current
                heapq.heappush(pq, (heuristic[node], node))

    path = []
    node = goal

    while node != start:
        path.append(node)
        node = parent[node]

    path.append(start)
    path.reverse()

    return path


result = greedy_search(campus, h, 'A', 'P')

print("Shortest Path:")
print(" -> ".join(result))